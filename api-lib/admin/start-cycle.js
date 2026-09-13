/**
 * POST /api/admin/start-cycle
 *
 * CRITICAL: This is the only action that starts the 7-day investment clock.
 *
 * Validations:
 *  - Caller must be admin
 *  - Cycle must be in ENTRY_CLOSED state (entry is closed)
 *  - At least 1 approved investment must exist for this cycle's entry
 *
 * Actions (all server-side, no client timestamps trusted):
 *  1. Record cycle_start_at = NOW() (authoritative server timestamp)
 *  2. Calculate cycle_end_at = cycle_start_at + configured duration (7 days / dev override)
 *  3. Activate all approved investments for this entry
 *  4. AUTO-CARRY FORWARD: find completed investments whose owners have NOT withdrawn
 *     and re-activate them in this new cycle automatically (no reinvest prompt needed)
 *  5. Lock eligible_units count on the cycle
 *  6. Set cycle status = 'ACTIVE'
 */

import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "./auth-check.js";
import { getCycleDurationMs, isDevAcceleratedMode } from "./cycle-config.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Verify admin
    const { adminUserId, error: authErr } = await verifyAdmin(req, supabaseAdmin);
    if (authErr) return res.status(authErr.status).json({ error: authErr.message });

    // 2. Find the cycle in ENTRY_CLOSED or READY_TO_START state
    const { data: cycle, error: cycleFetchErr } = await supabaseAdmin
      .from("investment_cycles")
      .select("*")
      .in("status", ["ENTRY_CLOSED", "READY_TO_START"])
      .order("cycle_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cycleFetchErr) throw cycleFetchErr;

    if (!cycle) {
      return res.status(404).json({
        error: "No cycle is ready to start. The entry must be closed first before starting a cycle."
      });
    }

    const entryId = cycle.entry_id;
    if (!entryId) {
      return res.status(400).json({ error: "Cycle has no linked entry window. Data integrity error." });
    }

    // 3. Get approved investments for this entry
    const { data: approvedInvestments, error: invFetchErr } = await supabaseAdmin
      .from("investments")
      .select("id, user_id, units, amount, status")
      .eq("entry_id", entryId)
      .eq("status", "approved");

    if (invFetchErr) throw invFetchErr;

    if (!approvedInvestments || approvedInvestments.length === 0) {
      return res.status(400).json({
        error: "Cannot start cycle: no approved investments found for this entry. Please approve at least one investment before starting the cycle."
      });
    }

    // 4. Use authoritative SERVER timestamp — client timestamps are never trusted
    const cycleDurationMs = getCycleDurationMs();
    const isDevMode = isDevAcceleratedMode();
    const cycleStartAt = new Date(); // server NOW()
    const cycleEndAt = new Date(cycleStartAt.getTime() + cycleDurationMs);
    const nowIso = cycleStartAt.toISOString();
    const endIso = cycleEndAt.toISOString();

    // 5. Activate all approved investments for this entry
    const investmentIds = approvedInvestments.map(inv => inv.id);

    const { error: invUpdateErr } = await supabaseAdmin
      .from("investments")
      .update({
        status: "active",
        start_date: nowIso,
        end_date: endIso
      })
      .in("id", investmentIds);

    if (invUpdateErr) throw invUpdateErr;

    // 6. AUTO-CARRY FORWARD
    //    When a new cycle starts, any investor whose previous investment COMPLETED
    //    but who has NOT submitted a withdrawal is automatically rolled into this cycle.
    //    No reinvest button needed — the system handles it transparently.
    let carryForwardCount = 0;

    try {
      // Get all completed investments from previous cycles
      const { data: completedInvs } = await supabaseAdmin
        .from("investments")
        .select("id, user_id, units, amount")
        .eq("status", "completed");

      if (completedInvs && completedInvs.length > 0) {
        // Track users already enrolled in this cycle (don't double-enroll)
        const alreadyEnrolledUserIds = new Set(approvedInvestments.map(inv => inv.user_id));

        for (const inv of completedInvs) {
          // Skip users who already enrolled via a new investment
          if (alreadyEnrolledUserIds.has(inv.user_id)) continue;

          // Check for pending withdrawals — if user submitted one, respect it
          const { data: pendingWithdrawals } = await supabaseAdmin
            .from("transactions")
            .select("amount")
            .eq("user_id", inv.user_id)
            .eq("type", "withdrawal")
            .eq("status", "pending");

          const totalPendingWithdrawal = (pendingWithdrawals || []).reduce(
            (sum, tx) => sum + Number(tx.amount || 0), 0
          );

          // Get user's current balance
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("balance")
            .eq("id", inv.user_id)
            .maybeSingle();

          const currentBalance = Number(profile?.balance || 0);
          const netBalance = currentBalance - totalPendingWithdrawal;

          // If user still has at least half their capital in the system,
          // carry their investment forward into this cycle automatically
          if (netBalance >= Number(inv.amount) * 0.5) {
            const { error: carryErr } = await supabaseAdmin
              .from("investments")
              .update({
                status: "active",
                start_date: nowIso,
                end_date: endIso,
                entry_id: entryId
              })
              .eq("id", inv.id)
              .eq("status", "completed"); // Guard: only update if still 'completed'

            if (!carryErr) {
              carryForwardCount++;
              alreadyEnrolledUserIds.add(inv.user_id);
              console.log(
                `[start-cycle] Auto-carried forward investment ${inv.id} ` +
                `for user ${inv.user_id} (balance: $${currentBalance})`
              );
            }
          }
        }
      }
    } catch (carryErr) {
      // Non-fatal: log but do not block cycle from starting
      console.warn("[start-cycle] Auto-carry forward error (non-fatal):", carryErr.message);
    }

    // 7. Re-fetch total active investments to get accurate eligible unit count
    const { data: allActiveInvs } = await supabaseAdmin
      .from("investments")
      .select("units, amount")
      .eq("entry_id", entryId)
      .eq("status", "active");

    const totalEligibleUnits = (allActiveInvs || []).reduce(
      (sum, inv) => sum + (Number(inv.units) || 1), 0
    );
    const totalEligibleAmount = (allActiveInvs || []).reduce(
      (sum, inv) => sum + Number(inv.amount), 0
    );

    // 8. Update cycle to ACTIVE with locked eligible units and server timestamps
    const { data: updatedCycle, error: cycleUpdateErr } = await supabaseAdmin
      .from("investment_cycles")
      .update({
        status: "ACTIVE",
        cycle_start_at: nowIso,
        cycle_end_at: endIso,
        eligible_units: totalEligibleUnits,
        eligible_amount: totalEligibleAmount,
        started_by: adminUserId,
        updated_at: nowIso
      })
      .eq("id", cycle.id)
      .select()
      .single();

    if (cycleUpdateErr) throw cycleUpdateErr;

    // 9. Update entry_windows status
    await supabaseAdmin
      .from("entry_windows")
      .update({ status: "READY_TO_START", updated_at: nowIso })
      .eq("id", entryId);

    console.log(
      `[start-cycle] Admin ${adminUserId} started Cycle #${cycle.cycle_number}. ` +
      `Start: ${nowIso}, End: ${endIso}. ` +
      `New: ${approvedInvestments.length}, Carried forward: ${carryForwardCount}. ` +
      `Total eligible units: ${totalEligibleUnits}. DevMode: ${isDevMode}`
    );

    return res.status(200).json({
      success: true,
      message: `Cycle #${cycle.cycle_number} is now ACTIVE! ${approvedInvestments.length} new + ${carryForwardCount} carried forward = ${totalEligibleUnits} eligible units. Due: ${cycleEndAt.toLocaleString()}`,
      cycle: updatedCycle,
      cycleStartAt: nowIso,
      cycleEndAt: endIso,
      eligibleUnits: totalEligibleUnits,
      eligibleInvestmentsCount: approvedInvestments.length + carryForwardCount,
      carryForwardCount,
      isDevMode,
      cycleDurationMs
    });

  } catch (err) {
    console.error("Error in start-cycle handler:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
