/**
 * POST /api/admin/confirm-withdrawal-paid
 *
 * Step 2 of the manual withdrawal flow.
 *
 * Flow:
 *  1. Admin approves a pending withdrawal request → transaction status → "approved"
 *     (balance is NOT deducted yet; admin must manually transfer funds)
 *  2. Admin physically transfers the funds to the investor's bank account
 *  3. Admin clicks "Confirm Paid" in the dashboard → this endpoint is called
 *  4. System deducts the withdrawal amount from the user's balance
 *  5. Transaction is marked "completed"
 *  6. User receives an in-app notification
 *
 * Security:
 *  - Caller must be a verified admin (JWT checked)
 *  - Amount is always read from DB — never trusted from client payload
 *  - Idempotent: repeated calls on an already-completed transaction return success
 *  - Only transactions with status "approved" can be confirmed
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

    // 1. Verify admin identity
    const { adminUserId, error: authErr } = await verifyAdmin(req, supabaseAdmin);
    if (authErr) return res.status(authErr.status).json({ error: authErr.message });

    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: "Missing required field: transactionId" });
    }

    // 2. Fetch the transaction — always read values from DB
    const { data: tx, error: txFetchErr } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .maybeSingle();

    if (txFetchErr || !tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // 3. Guard: must be a withdrawal
    if (tx.type !== "withdrawal") {
      return res.status(400).json({ error: "This transaction is not a withdrawal." });
    }

    // 4. Idempotency: already completed → no double-deduction
    if (tx.status === "completed") {
      return res.status(200).json({
        ok: true,
        alreadyCompleted: true,
        message: "This withdrawal was already marked as paid and the balance has been deducted.",
      });
    }

    // 5. Guard: must be in "approved" state (not still pending, not rejected)
    if (tx.status !== "approved") {
      return res.status(409).json({
        error: `Cannot confirm payment: transaction status is "${tx.status}". Only "approved" withdrawals can be confirmed as paid.`,
      });
    }

    const targetUserId = tx.user_id;
    // SECURITY: Always use DB amount
    const dbAmount = Number(tx.amount);
    const nowIso = new Date().toISOString();

    // 6. Fetch current user balances
    const { data: uProf, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("balance, accrued_return, name")
      .eq("id", targetUserId)
      .maybeSingle();

    if (profErr || !uProf) {
      return res.status(404).json({ error: "User profile not found" });
    }

    // 7. Calculate deduction — drain balance first, then accrued_return
    let curBal = Number(uProf.balance || 0);
    let curAccrued = Number(uProf.accrued_return || 0);
    let toDeduct = dbAmount;

    if (curBal >= toDeduct) {
      curBal -= toDeduct;
      toDeduct = 0;
    } else {
      toDeduct -= curBal;
      curBal = 0;
      curAccrued = Math.max(0, curAccrued - toDeduct);
    }

    // 8. Deduct balance from profile
    const { error: updateProfErr } = await supabaseAdmin
      .from("profiles")
      .update({
        balance: Math.round(curBal * 100) / 100,
        accrued_return: Math.round(curAccrued * 100) / 100,
        last_withdrawal_date: nowIso,
        updated_at: nowIso,
      })
      .eq("id", targetUserId);

    if (updateProfErr) {
      console.error("[confirm-withdrawal-paid] Failed to update profile balance:", updateProfErr.message);
      return res.status(500).json({ error: "Failed to deduct balance. Please try again." });
    }

    // 9. Mark transaction as completed (only if still "approved" — prevents races)
    const { data: updatedTx, error: txUpdateErr } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "completed",
        approved_at: nowIso,
        approved_by: adminUserId,
      })
      .eq("id", transactionId)
      .eq("status", "approved") // extra guard against race conditions
      .select()
      .single();

    if (txUpdateErr) {
      console.error("[confirm-withdrawal-paid] Failed to mark tx completed:", txUpdateErr.message);
      return res.status(500).json({
        error: "Balance was deducted but transaction status could not be updated. Please check Admin Portal.",
      });
    }

    // 10. Send in-app notification to the user
    try {
      await supabaseAdmin.from("notifications").insert({
        user_id: targetUserId,
        title: "Withdrawal Paid ✅",
        message: `Your withdrawal of $${dbAmount.toFixed(2)} has been processed and paid. Your account balance has been updated.`,
        type: "withdrawal_approved",
        read: false,
      });
    } catch (_) {
      // Non-critical — ignore notification errors
    }

    const investorName = uProf.name || "Investor";
    console.log(
      `[confirm-withdrawal-paid] ✅ Admin ${adminUserId} confirmed payment of $${dbAmount} for ${investorName} (tx: ${transactionId})`
    );

    return res.status(200).json({
      ok: true,
      transaction: updatedTx,
      message: `Payment confirmed. $${dbAmount.toFixed(2)} has been deducted from ${investorName}'s account.`,
    });

  } catch (err) {
    console.error("[confirm-withdrawal-paid] Unhandled error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
