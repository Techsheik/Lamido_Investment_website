/**
 * GET /api/admin/get-carry-forward-preview
 *
 * Returns the list of investors who would be auto-carried-forward if
 * the admin starts a cycle right now.
 *
 * Logic mirrors start-cycle.js carry-forward section:
 *  - Find last FINALIZED cycle's distributions
 *  - For each investor who got profit, check current balance minus pending withdrawals
 *  - If net_available >= $70 (min unit), include them in the preview
 *  - Exclude test accounts and users already in the current entry's approved list
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
      .select("id, cycle_number")
      .eq("status", "FINALIZED")
      .order("cycle_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastCycle) {
      return res.status(200).json({ candidates: [], reason: "No finalized cycle found" });
    }

    // 2. Get distributions from the last cycle
    const { data: lastDistributions } = await supabaseAdmin
      .from("cycle_distributions")
      .select("user_id, profit")
      .eq("cycle_id", lastCycle.id);

    if (!lastDistributions || lastDistributions.length === 0) {
      return res.status(200).json({ candidates: [], reason: "No distributions in last cycle" });
    }

    // 3. Find the current entry's approved users (to avoid double-enrolling)
    const { data: currentCycle } = await supabaseAdmin
      .from("investment_cycles")
      .select("entry_id")
      .in("status", ["ENTRY_CLOSED", "READY_TO_START"])
      .order("cycle_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    let alreadyEnrolledUserIds = new Set();

    if (currentCycle?.entry_id) {
      const { data: currentApproved } = await supabaseAdmin
        .from("investments")
        .select("user_id")
        .eq("entry_id", currentCycle.entry_id)
        .eq("status", "approved");

      alreadyEnrolledUserIds = new Set((currentApproved || []).map(inv => inv.user_id));
    }

    // 4. Aggregate profit per user
    const userProfitMap = new Map();
    for (const dist of lastDistributions) {
      const existing = userProfitMap.get(dist.user_id) || 0;
      userProfitMap.set(dist.user_id, existing + Number(dist.profit || 0));
    }

    // 5. Check each user's eligibility
    const candidates = [];

    for (const [userId, profit] of userProfitMap.entries()) {
      if (profit <= 0) continue;
      if (alreadyEnrolledUserIds.has(userId)) continue;

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("balance, name, user_code, is_test_account")
        .eq("id", userId)
        .maybeSingle();

      if (!profile) continue;
      if (profile.is_test_account) continue;

      const currentBalance = Number(profile.balance || 0);

      const { data: pendingWithdrawals } = await supabaseAdmin
        .from("transactions")
        .select("amount")
        .eq("user_id", userId)
        .eq("type", "withdrawal")
        .in("status", ["pending", "approved"]);

      const totalPendingWithdrawal = (pendingWithdrawals || []).reduce(
        (sum, tx) => sum + Number(tx.amount || 0), 0
      );

      const netAvailable = currentBalance - totalPendingWithdrawal;

      if (netAvailable < MIN_UNIT_COST) continue;

      const units = Math.floor(netAvailable / MIN_UNIT_COST);
      const amount = units * MIN_UNIT_COST;

      candidates.push({
        user_id: userId,
        name: profile.name,
        user_code: profile.user_code,
        balance: currentBalance,
        net_available: netAvailable,
        units,
        amount,
        last_cycle_profit: Math.round(profit * 100) / 100,
      });
    }

    return res.status(200).json({
      last_cycle_number: lastCycle.cycle_number,
      candidates,
    });

  } catch (err) {
    console.error("[get-carry-forward-preview] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
