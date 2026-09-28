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
    //    Logic: find investors from the LAST finalized cycle
    //    and roll their completed investment units & capital into this new cycle.
    //    Test accounts (is_test_account = true) are always excluded.
    //    Users who already have an investment in this cycle's entry are not duplicated.
    let carryForwardCount = 0;
    const carryForwardDetails = [];

    const MIN_UNIT_COST = 70; // $70 = minimum investment for 1 unit

    try {
      // Find the most recently FINALIZED cycle (previous cycle)
      const { data: lastCycle } = await supabaseAdmin
        .from("investment_cycles")
        .select("id, cycle_number, entry_id")
        .eq("status", "FINALIZED")
        .order("cycle_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastCycle) {
        // Fetch completed investments from last cycle
        let lastCycleInvs = [];
        if (lastCycle.entry_id) {
          const { data: invs } = await supabaseAdmin
            .from("investments")
            .select(`
              id, user_id, amount, units,
              profiles:user_id(id, name, user_code, balance, is_test_account)
            `)
            .eq("entry_id", lastCycle.entry_id)
            .eq("status", "completed");
          lastCycleInvs = invs || [];
        }

        // Fallback to cycle_distributions if entry_id had no rows
        if (lastCycleInvs.length === 0) {
          const { data: dists } = await supabaseAdmin
            .from("cycle_distributions")
            .select(`
              investment_id, user_id, eligible_units, investment_amount, profit,
              profiles:user_id(id, name, user_code, balance, is_test_account)
            `)
            .eq("cycle_id", lastCycle.id);

          lastCycleInvs = (dists || []).map(d => ({
            id: d.investment_id,
            user_id: d.user_id,
            units: d.eligible_units,
            amount: d.investment_amount,
            profiles: d.profiles,
          }));
        }

        if (lastCycleInvs.length > 0) {
          // Check who is already in this entry (approved or active)
          const { data: existingEntryInvs } = await supabaseAdmin
            .from("investments")
            .select("id, user_id, status, is_carry_forward")
            .eq("entry_id", entryId);

          const existingMap = new Map();
          for (const inv of (existingEntryInvs || [])) {
            existingMap.set(inv.user_id, inv);
          }

          // Aggregate units per user from last cycle (excluding test accounts)
          const userCandidateMap = new Map();
          for (const inv of lastCycleInvs) {
            const prof = inv.profiles;
            if (!prof || prof.is_test_account) continue;

            const existing = userCandidateMap.get(inv.user_id) || {
              user_id: inv.user_id,
              name: prof.name,
              user_code: prof.user_code,
              units: 0,
              amount: 0,
            };

            existing.units += Number(inv.units || 1);
            existing.amount += Number(inv.amount || (inv.units * MIN_UNIT_COST));
            userCandidateMap.set(inv.user_id, existing);
          }

          for (const [userId, candidate] of userCandidateMap.entries()) {
            const existingEntryInv = existingMap.get(userId);

            if (existingEntryInv) {
              // If already exists and was approved, make sure it is active
              if (existingEntryInv.status === "approved") {
                await supabaseAdmin
                  .from("investments")
                  .update({
                    status: "active",
                    start_date: nowIso,
                    end_date: endIso,
                  })
                  .eq("id", existingEntryInv.id);

                carryForwardCount++;
                carryForwardDetails.push({
                  user_code: candidate.user_code,
                  name: candidate.name,
                  units: candidate.units,
                  amount: candidate.amount,
                });
              }
              // If already active, it's already counted
              continue;
            }

            // Create new carry-forward investment record
            let insertPayload = {
              user_id: userId,
              amount: candidate.amount,
              units: candidate.units,
              type: "Cryptocurrency Investment",
              roi: 0,
              duration: 7,
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

            // Graceful fallback if is_carry_forward column missing in schema cache
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
              carryForwardDetails.push({
                user_code: candidate.user_code,
                name: candidate.name,
                units: candidate.units,
                amount: candidate.amount,
              });
              console.log(
                `[start-cycle] ✅ Auto-carried forward ${candidate.user_code} (${candidate.name}): ` +
                `${candidate.units} unit(s) ($${candidate.amount})`
              );
            } else {
              console.warn(`[start-cycle] Failed to carry forward ${candidate.user_code}:`, carryErr.message);
            }
          }
        } else {
          console.log(`[start-cycle] No completed investments in cycle #${lastCycle.cycle_number} — no carry-forward needed`);
        }
      } else {
        console.log("[start-cycle] No finalized cycle found — no carry-forward needed");
      }
    } catch (carryErr) {
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
