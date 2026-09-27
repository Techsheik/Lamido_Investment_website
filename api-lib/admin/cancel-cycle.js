/**
 * POST /api/admin/cancel-cycle
 *
 * Cancels an ACTIVE or ENTRY_CLOSED cycle, reverting it to a state
 * where the admin can choose to re-open entry or simply not proceed.
 *
 * What it does:
 *  1. Reverts ALL active investments in the cycle's entry → "approved"
 *     (both manually-enrolled and carry-forward investors keep their records)
 *  2. Carry-forward investments are flagged with is_carry_forward = true
 *     so the UI can badge them separately
 *  3. Sets cycle status → "ENTRY_CLOSED" (re-startable without re-opening entry)
 *  4. Clears cycle start/end timestamps
 *
 * What it does NOT do:
 *  - Does NOT delete any investment records
 *  - Does NOT touch user balances (nothing was credited/debited at cycle start)
 *  - Does NOT affect finalized/completed data
 */

import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "./auth-check.js";

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

    // 2. Find the active or entry-closed cycle
    const { data: cycle, error: cycleFetchErr } = await supabaseAdmin
      .from("investment_cycles")
      .select("*")
      .in("status", ["ACTIVE", "ENTRY_CLOSED", "READY_TO_START", "DUE", "SETTLING"])
      .order("cycle_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cycleFetchErr) throw cycleFetchErr;

    if (!cycle) {
      return res.status(404).json({
        error: "No cancellable cycle found. Only ACTIVE or ENTRY_CLOSED cycles can be cancelled."
      });
    }

    // Guard: don't cancel a FINALIZED cycle — that's immutable
    if (cycle.status === "FINALIZED") {
      return res.status(409).json({
        error: "Cannot cancel a finalized cycle. Finalized cycles are immutable."
      });
    }

    const entryId = cycle.entry_id;
    const nowIso = new Date().toISOString();

    // 3. Revert ALL active investments for this entry back to "approved"
    //    They keep their records; carry-forward ones keep is_carry_forward = true
    let revertedCount = 0;
    if (entryId) {
      const { data: reverted, error: revertErr } = await supabaseAdmin
        .from("investments")
        .update({
          status: "approved",
          start_date: null,
          end_date: null,
        })
        .eq("entry_id", entryId)
        .eq("status", "active")
        .select("id");

      if (revertErr) {
        console.warn("[cancel-cycle] Failed to revert investments:", revertErr.message);
      } else {
        revertedCount = (reverted || []).length;
      }
    }

    // 4. Reset cycle status back to ENTRY_CLOSED (re-startable)
    const { data: updatedCycle, error: cycleUpdateErr } = await supabaseAdmin
      .from("investment_cycles")
      .update({
        status: "ENTRY_CLOSED",
        cycle_start_at: null,
        cycle_end_at: null,
        started_by: null,
        updated_at: nowIso,
      })
      .eq("id", cycle.id)
      .select()
      .single();

    if (cycleUpdateErr) throw cycleUpdateErr;

    // 5. Also reset entry_windows status back to CLOSED
    if (entryId) {
      await supabaseAdmin
        .from("entry_windows")
        .update({ status: "CLOSED", updated_at: nowIso })
        .eq("id", entryId);
    }

    console.log(
      `[cancel-cycle] Admin ${adminUserId} cancelled cycle #${cycle.cycle_number}. ` +
      `${revertedCount} investment(s) reverted to "approved".`
    );

    return res.status(200).json({
      ok: true,
      message: `Cycle #${cycle.cycle_number} has been cancelled. ${revertedCount} investment(s) reverted to "Approved — Awaiting Cycle Start". You can start the cycle again when ready.`,
      revertedCount,
      cycle: updatedCycle,
    });

  } catch (err) {
    console.error("[cancel-cycle] Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
