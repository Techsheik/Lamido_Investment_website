/**
 * GET /api/admin/get-carry-forward-preview
 *
 * Returns the list of investors who will be auto-carried-forward if
 * the admin starts a cycle right now.
 *
 * Logic:
 *  - Find last FINALIZED cycle
 *  - Fetch completed investments from that cycle
 *  - Exclude test accounts (is_test_account = true)
 *  - Exclude investors already enrolled in the current entry (e.g. approved)
 *  - For each eligible investor, their previous investment units & capital carry forward
 *  - If unwithdrawn profit is >= $70, it can compound into extra units
 *
 * This endpoint is read-only (no DB writes).
 */

import { createClient } from "@supabase/supabase-js";

const MIN_UNIT_COST = 70;

export default async function handler(req, res) {
  if (req.method !== "GET") {
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

    // 1. Find the last FINALIZED cycle
    const { data: lastCycle } = await supabaseAdmin
      .from("investment_cycles")
      .select("id, cycle_number, entry_id")
      .eq("status", "FINALIZED")
      .order("cycle_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastCycle) {
      return res.status(200).json({ candidates: [], reason: "No finalized cycle found" });
    }

    // 2. Get investments from that last cycle
    // Query by entry_id first; if none, query by cycle_distributions
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

    // If no investments found by entry_id, fall back to cycle_distributions
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

    // 3. Find users already enrolled in the current entry
    const { data: currentCycle } = await supabaseAdmin
      .from("investment_cycles")
      .select("entry_id")
      .in("status", ["ENTRY_CLOSED", "READY_TO_START", "ENTRY_OPEN", "ACTIVE"])
      .order("cycle_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    let alreadyEnrolledUserIds = new Set();
    if (currentCycle?.entry_id) {
      const { data: currentInvs } = await supabaseAdmin
        .from("investments")
        .select("user_id")
        .eq("entry_id", currentCycle.entry_id)
        .in("status", ["approved", "active"]);

      alreadyEnrolledUserIds = new Set((currentInvs || []).map(inv => inv.user_id));
    }

    // 4. Build candidate list (aggregate by user_id if multiple investments)
    const userCandidatesMap = new Map();

    for (const inv of lastCycleInvs) {
      const prof = inv.profiles;
      if (!prof) continue;
      // Skip test accounts
      if (prof.is_test_account) continue;
      // Skip users already enrolled in this cycle
      if (alreadyEnrolledUserIds.has(inv.user_id)) continue;

      const existing = userCandidatesMap.get(inv.user_id) || {
        user_id: inv.user_id,
        name: prof.name,
        user_code: prof.user_code,
        units: 0,
        amount: 0,
        balance: Number(prof.balance || 0),
      };

      existing.units += Number(inv.units || 1);
      existing.amount += Number(inv.amount || (inv.units * MIN_UNIT_COST));
      userCandidatesMap.set(inv.user_id, existing);
    }

    const candidates = Array.from(userCandidatesMap.values());

    return res.status(200).json({
      last_cycle_number: lastCycle.cycle_number,
      total_candidate_units: candidates.reduce((s, c) => s + c.units, 0),
      total_candidate_amount: candidates.reduce((s, c) => s + c.amount, 0),
      candidates,
    });

  } catch (err) {
    console.error("[get-carry-forward-preview] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
