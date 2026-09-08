/**
 * POST /api/admin/close-entry
 *
 * Admin closes the current entry window.
 * After this, users can no longer submit new investments for this cycle.
 * Moves entry status to ENTRY_CLOSED and cycle status to ENTRY_CLOSED.
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

    // 2. Find the open entry
    const { data: openEntry, error: entryFetchErr } = await supabaseAdmin
      .from("entry_windows")
      .select("*")
      .eq("status", "ENTRY_OPEN")
      .maybeSingle();

    if (entryFetchErr) throw entryFetchErr;

    if (!openEntry) {
      return res.status(404).json({ error: "No open entry window found to close." });
    }

    const nowIso = new Date().toISOString();

    // 3. Count investments submitted for this entry
    const { count: investmentCount } = await supabaseAdmin
      .from("investments")
      .select("id", { count: "exact", head: true })
      .eq("entry_id", openEntry.id);

    // 4. Update entry_windows status to ENTRY_CLOSED
    const { error: entryUpdateErr } = await supabaseAdmin
      .from("entry_windows")
      .update({
        status: "ENTRY_CLOSED",
        closed_at: nowIso,
        closed_by: adminUserId,
        updated_at: nowIso
      })
      .eq("id", openEntry.id);

    if (entryUpdateErr) throw entryUpdateErr;

    // 5. Update linked investment_cycles status to ENTRY_CLOSED
    const { data: updatedCycle, error: cycleUpdateErr } = await supabaseAdmin
      .from("investment_cycles")
      .update({ status: "ENTRY_CLOSED", updated_at: nowIso })
      .eq("entry_id", openEntry.id)
      .select()
      .maybeSingle();

    if (cycleUpdateErr) throw cycleUpdateErr;

    console.log(`[close-entry] Admin ${adminUserId} closed Entry for Cycle #${openEntry.cycle_number}. ${investmentCount || 0} investments submitted.`);

    return res.status(200).json({
      success: true,
      message: `Entry window for Cycle #${openEntry.cycle_number} is now CLOSED. ${investmentCount || 0} investment(s) submitted. You may now review and approve them.`,
      entry: { ...openEntry, status: "ENTRY_CLOSED", closed_at: nowIso },
      cycle: updatedCycle,
      investmentCount: investmentCount || 0
    });

  } catch (err) {
    console.error("Error in close-entry handler:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
