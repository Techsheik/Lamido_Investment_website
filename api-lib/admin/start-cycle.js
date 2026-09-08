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
 *  3. Update all approved investments for this entry → status='active', start_date=cycle_start_at, end_date=cycle_end_at
 *  4. Lock eligible_units count on the cycle
 *  5. Set cycle status = 'ACTIVE'
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
    //    NOTE: We fetch without a join to avoid schema cache FK issues after migration
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

    // 5. Lock eligible_units — count from approved investments at THIS moment
    const totalEligibleUnits = approvedInvestments.reduce(
      (sum, inv) => sum + (Number(inv.units) || 1),
      0
    );
    const totalEligibleAmount = approvedInvestments.reduce(
      (sum, inv) => sum + Number(inv.amount),
      0
    );

    // 6. Activate all approved investments — set dates from cycle start (NOT client, NOT approval time)
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

    // 7. Update cycle to ACTIVE with locked eligible units and server timestamps
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

    // 8. Update entry_windows to READY_TO_START (cycle started, entry phase done)
    await supabaseAdmin
      .from("entry_windows")
      .update({ status: "READY_TO_START", updated_at: nowIso })
      .eq("id", entryId);

    console.log(
      `[start-cycle] Admin ${adminUserId} started Cycle #${cycle.cycle_number}. ` +
      `Start: ${nowIso}, End: ${endIso}. ` +
      `Eligible units: ${totalEligibleUnits} (${approvedInvestments.length} investments). ` +
      `DevMode: ${isDevMode} (${Math.round(cycleDurationMs / 60000)} mins)`
    );

    return res.status(200).json({
      success: true,
      message: `Cycle #${cycle.cycle_number} is now ACTIVE! ${approvedInvestments.length} investment(s) activated with ${totalEligibleUnits} eligible units. Due: ${cycleEndAt.toLocaleString()}`,
      cycle: updatedCycle,
      cycleStartAt: nowIso,
      cycleEndAt: endIso,
      eligibleUnits: totalEligibleUnits,
      eligibleInvestmentsCount: approvedInvestments.length,
      isDevMode,
      cycleDurationMs
    });

  } catch (err) {
    console.error("Error in start-cycle handler:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
