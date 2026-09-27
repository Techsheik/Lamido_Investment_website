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
    //    Logic: find investors from the LAST finalized cycle who received a
    //    distribution profit, haven't fully withdrawn it (balance >= $70 = 1 unit),
    //    and haven't already enrolled in this new cycle.
    //    Test accounts (is_test_account = true) are always excluded.
    let carryForwardCount = 0;
    const carryForwardDetails = [];

    const MIN_UNIT_COST = 70; // $70 = minimum investment for 1 unit

    try {
      // Find the most recently FINALIZED cycle (previous cycle)
      const { data: lastCycle } = await supabaseAdmin
        .from("investment_cycles")
        .select("id, cycle_number")
        .eq("status", "FINALIZED")
        .order("cycle_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastCycle) {
        // Get all distributions from the last cycle
        const { data: lastDistributions } = await supabaseAdmin
          .from("cycle_distributions")
          .select("user_id, profit, total_return")
          .eq("cycle_id", lastCycle.id);

        if (lastDistributions && lastDistributions.length > 0) {
          // Track users already enrolled in this cycle (don't double-enroll)
          const alreadyEnrolledUserIds = new Set(approvedInvestments.map(inv => inv.user_id));

          // Aggregate profit per user (one user can have multiple distribution rows)
          const userProfitMap = new Map();
          for (const dist of lastDistributions) {
            const existing = userProfitMap.get(dist.user_id) || 0;
            userProfitMap.set(dist.user_id, existing + Number(dist.profit || 0));
          }

          for (const [userId, profit] of userProfitMap.entries()) {
            // Skip users already enrolled in this cycle
            if (alreadyEnrolledUserIds.has(userId)) continue;

            // Skip if they got no profit (shouldn't happen, but guard it)
            if (profit <= 0) continue;

            // Fetch their current profile — check balance and test account flag
            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("balance, name, user_code, is_test_account")
              .eq("id", userId)
              .maybeSingle();

            if (!profile) continue;

            // Skip test accounts — they are never included in distributions
            if (profile.is_test_account) {
              console.log(`[start-cycle] Skipping test account ${profile.user_code} from carry-forward`);
              continue;
            }

            const currentBalance = Number(profile.balance || 0);

            // Check for pending/approved withdrawals (money the user has requested but not yet received)
            const { data: pendingWithdrawals } = await supabaseAdmin
              .from("transactions")
              .select("amount")
              .eq("user_id", userId)
              .eq("type", "withdrawal")
              .in("status", ["pending", "approved"]);

            const totalPendingWithdrawal = (pendingWithdrawals || []).reduce(
              (sum, tx) => sum + Number(tx.amount || 0), 0
            );

            // Net available balance (after accounting for pending withdrawals)
            const netAvailable = currentBalance - totalPendingWithdrawal;

            // Only carry forward if they have enough for at least 1 unit ($70)
            if (netAvailable < MIN_UNIT_COST) {
              console.log(
                `[start-cycle] Skipping ${profile.user_code}: net balance $${netAvailable.toFixed(2)} < $${MIN_UNIT_COST} minimum`
              );
              continue;
            }

            // Calculate how many units their balance buys
            const units = Math.floor(netAvailable / MIN_UNIT_COST);
            const investmentAmount = units * MIN_UNIT_COST;

            // Create a new investment record for them in this cycle's entry
            // Tag as carry_forward so the UI can badge them separately
            let insertPayload = {
              user_id: userId,
              amount: investmentAmount,
              units: units,
              status: "active",
              entry_id: entryId,
              start_date: nowIso,
              end_date: endIso,
              created_at: nowIso,
              is_carry_forward: true,
            };

            let { error: carryErr } = await supabaseAdmin
              .from("investments")
              .insert(insertPayload);

            // If is_carry_forward column doesn't exist yet (migration not run), retry without it
            if (carryErr && (
              carryErr.message?.includes("is_carry_forward") ||
              carryErr.message?.includes("schema cache") ||
              carryErr.message?.includes("column")
            )) {
              console.warn("[start-cycle] is_carry_forward column missing, retrying without it...");
              const { error: retryErr } = await supabaseAdmin
                .from("investments")
                .insert({ ...insertPayload, is_carry_forward: undefined });
              carryErr = retryErr;
            }

            if (!carryErr) {
              carryForwardCount++;
              alreadyEnrolledUserIds.add(userId);
              carryForwardDetails.push({
                user_code: profile.user_code,
                name: profile.name,
                balance: currentBalance,
                net_available: netAvailable,
                units,
                amount: investmentAmount,
              });
              console.log(
                `[start-cycle] ✅ Auto-carried forward ${profile.user_code} (${profile.name}): ` +
                `$${netAvailable.toFixed(2)} net balance → ${units} unit(s) ($${investmentAmount})`
              );
            } else {
              console.warn(`[start-cycle] Failed to carry forward ${profile.user_code}:`, carryErr.message);
            }
          }
        } else {
          console.log(`[start-cycle] No distributions found for last cycle #${lastCycle.cycle_number} — no carry-forward needed`);
        }
      } else {
        console.log("[start-cycle] No finalized cycle found — this is likely the first cycle, no carry-forward");
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
      message: `Cycle #${cycle.cycle_number} is now ACTIVE! ${approvedInvestments.length} new + ${carryForwardCount} auto-carried forward = ${totalEligibleUnits} eligible units. Due: ${cycleEndAt.toLocaleString()}`,
      cycle: updatedCycle,
      cycleStartAt: nowIso,
      cycleEndAt: endIso,
      eligibleUnits: totalEligibleUnits,
      eligibleInvestmentsCount: approvedInvestments.length + carryForwardCount,
      carryForwardCount,
      carryForwardDetails,
      isDevMode,
      cycleDurationMs
    });

  } catch (err) {
    console.error("Error in start-cycle handler:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
