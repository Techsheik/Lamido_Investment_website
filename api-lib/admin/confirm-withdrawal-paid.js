/**
 * POST /api/admin/confirm-withdrawal-paid
 *
 * Admin confirms they have physically transferred funds to the investor's bank.
 * This endpoint:
 *  1. Reads the withdrawal amount from the DB (never trusts client payload)
 *  2. Deducts the amount from the user's balance
 *  3. Marks the transaction as "completed"
 *
 * Accepts transactions in EITHER "pending" OR "approved" state —
 * so admin can confirm payment in one step if they skipped the intermediate
 * "approve" button (e.g., old pending transactions from before the two-step flow).
 *
 * Security:
 *  - Admin JWT required (verifyAdmin)
 *  - Amount always read from DB — never from client
 *  - Idempotent: repeated calls on already-completed tx return success without double-deduct
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

    // 5. Guard: only pending or approved withdrawals can be confirmed
    //    (rejected ones cannot be confirmed — they were cancelled)
    if (tx.status === "rejected") {
      return res.status(409).json({
        error: `Cannot confirm payment: this withdrawal was rejected/cancelled.`,
      });
    }

    // Allow both "pending" and "approved" — admin may confirm in one step
    if (tx.status !== "pending" && tx.status !== "approved") {
      return res.status(409).json({
        error: `Cannot confirm payment: unexpected status "${tx.status}".`,
      });
    }

    const targetUserId = tx.user_id;
    // SECURITY: Always use DB amount — never the client-supplied value
    const dbAmount = Number(tx.amount);
    const nowIso = new Date().toISOString();

    console.log(`[confirm-withdrawal-paid] Processing $${dbAmount} withdrawal for user ${targetUserId} (tx: ${transactionId}, status was: ${tx.status})`);

    // 6. Fetch current user balances (including total_roi)
    const { data: uProf, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("balance, accrued_return, total_roi, name")
      .eq("id", targetUserId)
      .maybeSingle();

    if (profErr || !uProf) {
      return res.status(404).json({ error: "User profile not found" });
    }

    // 7. Calculate deduction — drain balance first, then accrued_return, and also deduct total_roi
    let curBal = Number(uProf.balance || 0);
    let curAccrued = Number(uProf.accrued_return || 0);
    let curTotalRoi = Number(uProf.total_roi || 0);
    let toDeduct = dbAmount;

    if (curBal >= toDeduct) {
      curBal -= toDeduct;
      toDeduct = 0;
    } else {
      toDeduct -= curBal;
      curBal = 0;
      curAccrued = Math.max(0, curAccrued - toDeduct);
    }

    const newBalance = Math.round(curBal * 100) / 100;
    const newAccrued = Math.round(curAccrued * 100) / 100;
    const newTotalRoi = Math.max(0, Math.round((curTotalRoi - dbAmount) * 100) / 100);

    // 8. Deduct balance from profile
    // Note: last_withdrawal_date is optional and omitted to avoid schema cache errors
    let profPayload = {
      balance: newBalance,
      accrued_return: newAccrued,
      total_roi: newTotalRoi,
      updated_at: nowIso,
    };

    let { error: updateProfErr } = await supabaseAdmin
      .from("profiles")
      .update(profPayload)
      .eq("id", targetUserId);

    if (updateProfErr) {
      console.error("[confirm-withdrawal-paid] Failed to update profile balance:", updateProfErr.message);
      return res.status(500).json({ error: `Failed to deduct balance: ${updateProfErr.message}` });
    }

    console.log(`[confirm-withdrawal-paid] Balance deducted: $${dbAmount} from user ${targetUserId}. New balance: $${newBalance}`);

    // 9. Mark transaction as completed
    //    NOTE: We do NOT guard with .eq("status", "approved") here —
    //    the transaction could be "pending" if admin skipped the approve step.
    //    We already fetched & validated the status above (steps 4–5).
    let txUpdatePayload = {
      status: "completed",
      approved_at: nowIso,
      approved_by: adminUserId,
    };

    let { data: updatedTx, error: txUpdateErr } = await supabaseAdmin
      .from("transactions")
      .update(txUpdatePayload)
      .eq("id", transactionId)
      .select()
      .single();

    // If approved_at/approved_by columns don't exist yet, retry with just status
    if (txUpdateErr && (
      txUpdateErr.message?.includes("approved_at") ||
      txUpdateErr.message?.includes("approved_by") ||
      txUpdateErr.message?.includes("schema cache") ||
      txUpdateErr.message?.includes("column") ||
      txUpdateErr.message?.includes("does not exist")
    )) {
      console.warn("[confirm-withdrawal-paid] Retrying without approval metadata columns...");
      const retry = await supabaseAdmin
        .from("transactions")
        .update({ status: "completed" })
        .eq("id", transactionId)
        .select()
        .single();
      updatedTx = retry.data;
      txUpdateErr = retry.error;
    }

    if (txUpdateErr) {
      console.error("[confirm-withdrawal-paid] Failed to mark tx completed:", txUpdateErr.message);
      // Balance was already deducted — don't roll back, just warn admin
      return res.status(500).json({
        error: `Balance was deducted ($${dbAmount.toFixed(2)}) but transaction status could not be updated to "completed". Please manually update the transaction status in Supabase.`,
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
