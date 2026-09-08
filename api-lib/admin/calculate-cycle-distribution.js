/**
 * POST /api/admin/calculate-cycle-distribution
 *
 * Preview distribution amounts before finalizing. Does NOT commit anything.
 * Admin auth required.
 */

import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "./auth-check.js";
import { calculatePPSU, calculateInvestorProfit } from "./cycle-config.js";

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

    const { cycleId, communityProfit } = req.body;
    const profitNum = Number(communityProfit);

    if (isNaN(profitNum) || profitNum < 0) {
      return res.status(400).json({ error: "Community profit must be a non-negative number" });
    }

    // 2. Find the target cycle
    let cycleQuery = supabaseAdmin
      .from("investment_cycles")
      .select("*")
      .in("status", ["DUE", "AWAITING_PROFIT", "SETTLING", "CALCULATED", "ACTIVE"]);

    if (cycleId) {
      cycleQuery = cycleQuery.eq("id", cycleId);
    } else {
      cycleQuery = cycleQuery.order("cycle_number", { ascending: false }).limit(1);
    }

    const { data: targetCycle, error: cycleFetchErr } = await cycleQuery.maybeSingle();
    if (cycleFetchErr) throw cycleFetchErr;

    if (!targetCycle) {
      return res.status(404).json({ error: "No active or due cycle found for calculation" });
    }

    if (targetCycle.status === "FINALIZED") {
      return res.status(400).json({ error: "Cycle is already finalized and cannot be recalculated" });
    }

    // 3. Fetch eligible investments from this cycle's entry
    const { data: eligibleInvestments, error: invFetchErr } = await supabaseAdmin
      .from("investments")
      .select(`
        *,
        profiles:user_id(id, name, email, user_code, balance)
      `)
      .eq("entry_id", targetCycle.entry_id)
      .in("status", ["active", "completed"])
      .order("created_at", { ascending: true });

    if (invFetchErr) throw invFetchErr;

    const eligible = eligibleInvestments || [];
    const totalEligibleUnits = eligible.reduce(
      (sum, inv) => sum + (Number(inv.units) || 1), 0
    );

    if (totalEligibleUnits <= 0) {
      return res.status(400).json({
        error: "Total eligible units must be greater than zero to calculate distribution"
      });
    }

    // 4. Calculate PPSU and per-investment preview
    const { rawPpsu, roundedPpsu } = calculatePPSU(profitNum, totalEligibleUnits);

    let totalCalculatedProfit = 0;
    const previewDistributions = eligible.map(inv => {
      const calc = calculateInvestorProfit(inv.units, inv.amount, rawPpsu);
      totalCalculatedProfit += calc.profit;
      return {
        investment_id: inv.id,
        user_id: inv.user_id,
        user_name: inv.profiles?.name || "Unknown",
        user_code: inv.profiles?.user_code || "N/A",
        units: calc.units,
        investment_amount: calc.investmentAmount,
        ppsu: roundedPpsu,
        profit: calc.profit,
        total_return: calc.totalReturn
      };
    });

    // 5. Update cycle status to SETTLING (intermediate state before finalize)
    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from("investment_cycles")
      .update({
        community_profit: profitNum,
        ppsu: roundedPpsu,
        status: "SETTLING",
        updated_at: nowIso
      })
      .eq("id", targetCycle.id);

    return res.status(200).json({
      cycle_id: targetCycle.id,
      cycle_number: targetCycle.cycle_number,
      community_profit: profitNum,
      eligible_units: totalEligibleUnits,
      ppsu: roundedPpsu,
      exact_ppsu: rawPpsu,
      total_calculated_profit: Math.round(totalCalculatedProfit * 100) / 100,
      distributions: previewDistributions
    });

  } catch (err) {
    console.error("Error in calculate-cycle-distribution handler:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
