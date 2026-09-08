/**
 * POST /api/admin/finalize-cycle-distribution
 *
 * Admin finalises the distribution for the current DUE/SETTLING cycle.
 *
 * CRITICAL CHANGES:
 *  - NO auto-creation of next cycle (admin opens next entry manually)
 *  - Full idempotency: duplicate calls blocked at DB level + status check
 *  - Admin auth required
 *  - Uses investment_cycles DB table (not JSON blob)
 *  - Only eligible investments from the cycle's locked entry are included
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
      return res.status(400).json({ error: "Community profit must be a valid non-negative number" });
    }

    // 2. Find the target cycle — must be in a finalizable state
    let cycleQuery = supabaseAdmin
      .from("investment_cycles")
      .select("*")
      .in("status", ["DUE", "AWAITING_PROFIT", "SETTLING", "CALCULATED"]);

    if (cycleId) {
      cycleQuery = cycleQuery.eq("id", cycleId);
    } else {
      cycleQuery = cycleQuery.order("cycle_number", { ascending: false }).limit(1);
    }

    const { data: targetCycle, error: cycleFetchErr } = await cycleQuery.maybeSingle();
    if (cycleFetchErr) throw cycleFetchErr;

    if (!targetCycle) {
      return res.status(404).json({
        error: "No cycle found in a finalizable state (DUE or SETTLING). The cycle must be due before finalizing."
      });
    }

    // 3. Idempotency guard — check if already finalized
    if (targetCycle.status === "FINALIZED") {
      return res.status(400).json({
        error: "CRITICAL: This cycle has already been finalized! Duplicate finalization is prevented."
      });
    }

    // 4. Check for existing distributions (additional idempotency layer at DB level)
    const { count: existingDistCount } = await supabaseAdmin
      .from("cycle_distributions")
      .select("id", { count: "exact", head: true })
      .eq("cycle_id", targetCycle.id);

    if (existingDistCount && existingDistCount > 0) {
      return res.status(400).json({
        error: `CRITICAL: ${existingDistCount} distribution record(s) already exist for this cycle. Duplicate finalization prevented.`
      });
    }

    // 5. Get eligible investments — ONLY from this cycle's locked entry
    //    These are the investments approved BEFORE the cycle started.
    //    We use start_date to identify them — they have start_date = cycle_start_at.
    const { data: eligibleInvestments, error: invFetchErr } = await supabaseAdmin
      .from("investments")
      .select(`
        *,
        profiles:user_id(id, name, email, user_code, balance, total_roi)
      `)
      .eq("entry_id", targetCycle.entry_id)
      .in("status", ["active", "completed"])
      .order("created_at", { ascending: true });

    if (invFetchErr) throw invFetchErr;

    if (!eligibleInvestments || eligibleInvestments.length === 0) {
      return res.status(400).json({
        error: "Cannot finalize: no eligible investments found for this cycle."
      });
    }

    const totalEligibleUnits = eligibleInvestments.reduce(
      (sum, inv) => sum + (Number(inv.units) || 1), 0
    );

    if (totalEligibleUnits <= 0) {
      return res.status(400).json({ error: "Cannot finalize: 0 eligible units" });
    }

    // 6. Calculate PPSU from ACTUAL community profit — no fixed ROI
    const { rawPpsu, roundedPpsu } = calculatePPSU(profitNum, totalEligibleUnits);

    const nowIso = new Date().toISOString();
    const distributionRecords = [];
    const userProfitMap = new Map();

    for (const inv of eligibleInvestments) {
      const calc = calculateInvestorProfit(inv.units, inv.amount, rawPpsu);

      distributionRecords.push({
        cycle_id: targetCycle.id,
        cycle_number: targetCycle.cycle_number,
        user_id: inv.user_id,
        investment_id: inv.id,
        eligible_units: calc.units,
        investment_amount: calc.investmentAmount,
        ppsu: roundedPpsu,
        profit: calc.profit,
        total_return: calc.totalReturn,
        created_at: nowIso
      });

      // Aggregate per user
      const existing = userProfitMap.get(inv.user_id) || { profit: 0, profile: inv.profiles };
      existing.profit += calc.profit;
      userProfitMap.set(inv.user_id, existing);
    }

    // 7. Insert distributions (DB unique constraint on cycle_id+investment_id prevents duplicates)
    const { error: distInsertErr } = await supabaseAdmin
      .from("cycle_distributions")
      .insert(distributionRecords);

    if (distInsertErr) {
      if (distInsertErr.message.includes("unique")) {
        return res.status(400).json({
          error: "CRITICAL: Duplicate distribution detected at DB level. This cycle has already been partially or fully distributed."
        });
      }
      throw distInsertErr;
    }

    // 8. Update user balances and total_roi
    for (const [userId, userData] of userProfitMap.entries()) {
      const currentBalance = Number(userData.profile?.balance || 0);
      const currentTotalRoi = Number(userData.profile?.total_roi || 0);
      const profitToAdd = Math.round(userData.profit * 100) / 100;

      await supabaseAdmin
        .from("profiles")
        .update({
          balance: Math.round((currentBalance + profitToAdd) * 100) / 100,
          total_roi: Math.round((currentTotalRoi + profitToAdd) * 100) / 100,
          updated_at: nowIso
        })
        .eq("id", userId);

      // Insert transaction audit record
      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        type: "roi",
        amount: profitToAdd,
        status: "completed",
        date: nowIso,
        approved_at: nowIso
      });
    }

    // 9. Finalize the cycle — set FINALIZED, no auto-next-cycle
    const { error: cycleUpdateErr } = await supabaseAdmin
      .from("investment_cycles")
      .update({
        status: "FINALIZED",
        community_profit: profitNum,
        eligible_units: totalEligibleUnits,
        ppsu: roundedPpsu,
        finalized_at: nowIso,
        updated_at: nowIso
      })
      .eq("id", targetCycle.id);

    if (cycleUpdateErr) throw cycleUpdateErr;

    // 10. Mark investments as completed
    await supabaseAdmin
      .from("investments")
      .update({ status: "completed" })
      .eq("entry_id", targetCycle.entry_id)
      .in("status", ["active"]);

    console.log(
      `[finalize-distribution] Admin ${adminUserId} finalized Cycle #${targetCycle.cycle_number}. ` +
      `Profit: $${profitNum}, PPSU: $${roundedPpsu}, Units: ${totalEligibleUnits}, ` +
      `Investors: ${userProfitMap.size}. NO next cycle auto-created.`
    );

    return res.status(200).json({
      success: true,
      message: `Cycle #${targetCycle.cycle_number} finalized. $${profitNum.toLocaleString()} distributed to ${userProfitMap.size} investor(s). When ready, open the next entry window to begin Cycle #${targetCycle.cycle_number + 1}.`,
      finalizedCycle: { ...targetCycle, status: "FINALIZED", community_profit: profitNum, ppsu: roundedPpsu },
      eligibleUnits: totalEligibleUnits,
      distributionsCount: distributionRecords.length,
      nextAction: "Use POST /api/admin/open-entry to begin the next entry window when ready."
    });

  } catch (err) {
    console.error("Error in finalize-cycle-distribution handler:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
