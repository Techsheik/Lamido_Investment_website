/**
 * POST /api/admin/open-entry
 *
 * Admin opens a new entry window. Investors can then submit investments.
 *
 * Validations:
 *  - Caller must be admin
 *  - No ENTRY_OPEN window already exists (one at a time)
 *  - No ACTIVE cycle is currently running
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

    // 2. Check no ENTRY_OPEN already exists
    const { data: existingOpen } = await supabaseAdmin
      .from("entry_windows")
      .select("id, cycle_number, opened_at")
      .eq("status", "ENTRY_OPEN")
      .maybeSingle();

    if (existingOpen) {
      return res.status(409).json({
        error: `An entry window is already open (Entry for Cycle #${existingOpen.cycle_number}). Close it before opening a new one.`,
        existingEntry: existingOpen
      });
    }

    // 3. Check no ACTIVE cycle is running
    const { data: activeCycle } = await supabaseAdmin
      .from("investment_cycles")
      .select("id, cycle_number, status")
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (activeCycle) {
      return res.status(409).json({
        error: `Cycle #${activeCycle.cycle_number} is currently ACTIVE. You cannot open a new entry window while a cycle is running.`,
        activeCycle
      });
    }

    // 4. Check if an unstarted cycle (ENTRY_CLOSED or READY_TO_START) exists to re-open
    const { data: unstartedCycle } = await supabaseAdmin
      .from("investment_cycles")
      .select("*")
      .in("status", ["ENTRY_CLOSED", "READY_TO_START"])
      .order("cycle_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nowIso = new Date().toISOString();

    if (unstartedCycle) {
      // Re-open existing unstarted cycle
      const { data: updatedCycle, error: reOpenCycleErr } = await supabaseAdmin
        .from("investment_cycles")
        .update({ status: "ENTRY_OPEN", updated_at: nowIso })
        .eq("id", unstartedCycle.id)
        .select()
        .single();

      if (reOpenCycleErr) throw reOpenCycleErr;

      if (unstartedCycle.entry_id) {
        await supabaseAdmin
          .from("entry_windows")
          .update({ status: "ENTRY_OPEN", updated_at: nowIso })
          .eq("id", unstartedCycle.entry_id);
      }

      console.log(`[open-entry] Admin ${adminUserId} re-opened Entry for Cycle #${unstartedCycle.cycle_number}`);

      return res.status(200).json({
        success: true,
        message: `Entry window re-opened for Cycle #${unstartedCycle.cycle_number}. Investors can now submit investments.`,
        cycle: updatedCycle
      });
    }

    // 5. If no unstarted cycle, determine next cycle number
    const { data: lastCycle } = await supabaseAdmin
      .from("investment_cycles")
      .select("cycle_number")
      .order("cycle_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextCycleNumber = (lastCycle?.cycle_number || 0) + 1;

    // 6. Create the investment_cycles row in ENTRY_OPEN state
    const { data: newCycle, error: cycleErr } = await supabaseAdmin
      .from("investment_cycles")
      .insert({
        cycle_number: nextCycleNumber,
        name: `Cycle #${nextCycleNumber}`,
        status: "ENTRY_OPEN",
        community_profit: 0,
        eligible_units: 0,
        ppsu: 0,
        created_at: nowIso,
        updated_at: nowIso
      })
      .select()
      .single();

    if (cycleErr) throw cycleErr;

    // 7. Create the entry_windows row
    const { data: newEntry, error: entryErr } = await supabaseAdmin
      .from("entry_windows")
      .insert({
        cycle_number: nextCycleNumber,
        status: "ENTRY_OPEN",
        opened_at: nowIso,
        opened_by: adminUserId,
        created_at: nowIso,
        updated_at: nowIso
      })
      .select()
      .single();

    if (entryErr) throw entryErr;

    // 8. Link entry to cycle
    await supabaseAdmin
      .from("investment_cycles")
      .update({ entry_id: newEntry.id, updated_at: nowIso })
      .eq("id", newCycle.id);

    // 8b. Auto-attach any unlinked investments (entry_id IS NULL) to this new entry window
    await supabaseAdmin
      .from("investments")
      .update({ entry_id: newEntry.id })
      .is("entry_id", null);

    console.log(`[open-entry] Admin ${adminUserId} opened Entry for Cycle #${nextCycleNumber}`);

    return res.status(200).json({
      success: true,
      message: `Entry window opened for Cycle #${nextCycleNumber}. Investors can now submit investments.`,
      entry: newEntry,
      cycle: { ...newCycle, entry_id: newEntry.id }
    });

  } catch (err) {
    console.error("Error in open-entry handler:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
