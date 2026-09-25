/**
 * POST /api/admin/clear-test-account
 *
 * Zeroes out a test account's financial data without deleting the user or
 * revoking their admin access.
 *
 * What it clears:
 *  - balance → 0
 *  - accrued_return → 0
 *  - total_roi → 0
 *  - total_invested → 0
 *  - last_withdrawal_date → null
 *  - All investments → cancelled
 *  - All pending/approved transactions → rejected
 *  - Marks the profile as is_test_account = true (excludes from distributions)
 *
 * What it DOES NOT touch:
 *  - Auth account (email/password)
 *  - Admin role in user_roles table
 *  - Profile info (name, email, phone, bank details)
 *  - Completed/ROI transactions (kept for audit trail)
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

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Missing required field: userId" });
    }

    // 2. Fetch the profile to confirm it exists
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, name, user_code, is_test_account")
      .eq("id", userId)
      .maybeSingle();

    if (profErr || !profile) {
      return res.status(404).json({ error: "User not found" });
    }

    const nowIso = new Date().toISOString();
    const results = { steps: [] };

    // 3. Zero out financial fields and mark as test account
    const { error: profileUpdateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        balance: 0,
        accrued_return: 0,
        total_roi: 0,
        total_invested: 0,
        last_withdrawal_date: null,
        is_test_account: true,
        updated_at: nowIso,
      })
      .eq("id", userId);

    if (profileUpdateErr) {
      console.error("[clear-test-account] Profile update error:", profileUpdateErr.message);
      return res.status(500).json({ error: "Failed to clear profile financials: " + profileUpdateErr.message });
    }
    results.steps.push("✅ Balance, ROI, and financial fields zeroed out");
    results.steps.push("✅ Marked as test account (excluded from future distributions)");

    // 4. Cancel all investments (active, pending, completed)
    const { data: cancelledInvs, error: invErr } = await supabaseAdmin
      .from("investments")
      .update({ status: "cancelled", updated_at: nowIso })
      .eq("user_id", userId)
      .in("status", ["active", "pending", "completed", "approved"])
      .select("id");

    if (invErr) {
      console.warn("[clear-test-account] Investment cancel warning:", invErr.message);
      results.steps.push("⚠️ Some investments could not be cancelled: " + invErr.message);
    } else {
      results.steps.push(`✅ ${(cancelledInvs || []).length} investment(s) cancelled`);
    }

    // 5. Reject all pending/approved financial transactions (deposits & withdrawals)
    const { data: rejectedTxs, error: txErr } = await supabaseAdmin
      .from("transactions")
      .update({ status: "rejected", approved_at: nowIso, approved_by: adminUserId })
      .eq("user_id", userId)
      .in("status", ["pending", "approved"])
      .in("type", ["deposit", "withdrawal"])
      .select("id");

    if (txErr) {
      console.warn("[clear-test-account] Transaction reject warning:", txErr.message);
      results.steps.push("⚠️ Some transactions could not be rejected: " + txErr.message);
    } else {
      results.steps.push(`✅ ${(rejectedTxs || []).length} pending transaction(s) rejected`);
    }

    console.log(
      `[clear-test-account] Admin ${adminUserId} cleared test account for ${profile.name} (${profile.user_code}, ${userId})`
    );

    return res.status(200).json({
      ok: true,
      message: `Test account cleared for ${profile.name} (${profile.user_code}). They are now excluded from all cycle distributions.`,
      results,
    });

  } catch (err) {
    console.error("[clear-test-account] Unhandled error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
