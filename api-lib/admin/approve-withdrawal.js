/**
 * GET /api/admin/approve-withdrawal?token=<signed_token>
 *
 * Secure one-click withdrawal approval from email.
 *
 * Flow:
 *  1. Admin receives withdrawal email with a signed approval link
 *  2. Admin clicks the link → this endpoint verifies the HMAC token
 *  3. Looks up the transaction (must still be "pending")
 *  4. Cross-validates amount in token matches DB amount (prevents tampering)
 *  5. Deducts balance from user profile
 *  6. Marks transaction as "completed"
 *  7. Returns an HTML page that auto-redirects to /admin dashboard
 *
 * Security:
 *  - Token is HMAC-SHA256 signed with SUPABASE_SERVICE_ROLE_KEY (never exposed to client)
 *  - Tokens expire after 7 days
 *  - Idempotent: repeated clicks return success without double-deducting
 *  - Transaction must be in "pending" state to approve
 *  - Amount cross-checked from DB, not from token, to prevent tampering
 */

import { createClient } from "@supabase/supabase-js";
import { verifyApprovalToken } from "../email-service.js";

function htmlRedirectPage({ title, message, success, appUrl }) {
  const bgColor = success ? "#f0fdf4" : "#fef2f2";
  const borderColor = success ? "#86efac" : "#fca5a5";
  const textColor = success ? "#15803d" : "#991b1b";
  const icon = success ? "✅" : "❌";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Lamido Investment</title>
  <meta http-equiv="refresh" content="4;url=${appUrl}/admin">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f5f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #fff; border-radius: 16px; padding: 48px 40px; max-width: 500px; width: 100%; text-align: center; box-shadow: 0 20px 40px -12px rgba(0,0,0,0.1); }
    .icon { font-size: 56px; margin-bottom: 20px; }
    .title { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 12px; }
    .message { font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px; }
    .badge { display: inline-block; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; background: ${bgColor}; color: ${textColor}; border: 1px solid ${borderColor}; margin-bottom: 28px; }
    .redirect { font-size: 13px; color: #94a3b8; margin-bottom: 20px; }
    .btn { display: inline-block; background: #0f172a; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 14px; }
    .logo { font-size: 14px; font-weight: 800; letter-spacing: 1px; color: #64748b; text-transform: uppercase; margin-top: 28px; }
    .logo span { color: #0284c7; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <div class="title">${title}</div>
    <div class="message">${message}</div>
    <div class="badge">${title}</div>
    <p class="redirect">Redirecting you to the Admin Dashboard in 4 seconds...</p>
    <a href="${appUrl}/admin" class="btn">Go to Admin Dashboard &rarr;</a>
    <div class="logo">LAMIDO <span>INVESTMENT</span></div>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const appUrl = process.env.APP_URL || "http://localhost:8080";
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    res.writeHead(500, { "Content-Type": "text/html" });
    return res.end(htmlRedirectPage({
      title: "Server Error",
      message: "Server is misconfigured. Please contact the system administrator.",
      success: false,
      appUrl
    }));
  }

  const token = req.query?.token;
  if (!token) {
    res.writeHead(400, { "Content-Type": "text/html" });
    return res.end(htmlRedirectPage({
      title: "Invalid Link",
      message: "This approval link is missing a security token. The link may be incomplete or corrupted.",
      success: false,
      appUrl
    }));
  }

  let tokenData;
  try {
    tokenData = verifyApprovalToken(token, secret);
  } catch (err) {
    console.error("[APPROVE WITHDRAWAL] Token verification failed:", err.message);
    res.writeHead(400, { "Content-Type": "text/html" });
    return res.end(htmlRedirectPage({
      title: "Invalid or Expired Link",
      message: `The approval link is invalid or has expired (${err.message}). Withdrawal approval links are valid for 7 days. Please use the Admin Portal to approve this withdrawal manually.`,
      success: false,
      appUrl
    }));
  }

  const { transactionId, userId, amount: tokenAmount } = tokenData;

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    secret
  );

  try {
    // 1. Fetch the transaction from DB
    const { data: tx, error: txFetchErr } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .maybeSingle();

    if (txFetchErr || !tx) {
      console.error("[APPROVE WITHDRAWAL] Transaction not found:", transactionId);
      res.writeHead(404, { "Content-Type": "text/html" });
      return res.end(htmlRedirectPage({
        title: "Transaction Not Found",
        message: `Transaction ID ${transactionId} was not found in the database. It may have been deleted.`,
        success: false,
        appUrl
      }));
    }

    // 2. Idempotency: already approved
    if (tx.status === "completed") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(htmlRedirectPage({
        title: "Already Approved",
        message: `This withdrawal of $${Number(tx.amount).toFixed(2)} was already approved on ${tx.approved_at ? new Date(tx.approved_at).toLocaleString() : "a previous occasion"}. No further action is needed.`,
        success: true,
        appUrl
      }));
    }

    // 3. Guard: must be pending
    if (tx.status !== "pending") {
      res.writeHead(409, { "Content-Type": "text/html" });
      return res.end(htmlRedirectPage({
        title: "Cannot Approve",
        message: `This withdrawal request has status "${tx.status}" and cannot be approved via this link. Please use the Admin Portal.`,
        success: false,
        appUrl
      }));
    }

    // 4. Amount cross-check: use DB amount (prevents tampering via token manipulation)
    const dbAmount = Number(tx.amount);
    if (Math.abs(dbAmount - Number(tokenAmount)) > 0.01) {
      console.error(`[APPROVE WITHDRAWAL] Amount mismatch: token=${tokenAmount}, db=${dbAmount}`);
      res.writeHead(409, { "Content-Type": "text/html" });
      return res.end(htmlRedirectPage({
        title: "Amount Mismatch",
        message: "The withdrawal amount in the link does not match the database record. This may indicate tampering. Please approve via Admin Portal.",
        success: false,
        appUrl
      }));
    }

    const targetUserId = tx.user_id || userId;
    const nowIso = new Date().toISOString();

    // 5. Fetch user profile balance
    const { data: uProf } = await supabaseAdmin
      .from("profiles")
      .select("balance, accrued_return, name")
      .eq("id", targetUserId)
      .maybeSingle();

    let curBal = Number(uProf?.balance || 0);
    let curAccrued = Number(uProf?.accrued_return || 0);
    let toDeduct = dbAmount;

    if (curBal >= toDeduct) {
      curBal -= toDeduct;
      toDeduct = 0;
    } else {
      toDeduct -= curBal;
      curBal = 0;
      curAccrued = Math.max(0, curAccrued - toDeduct);
    }

    // 6. Deduct balance
    await supabaseAdmin
      .from("profiles")
      .update({
        balance: Math.round(curBal * 100) / 100,
        accrued_return: Math.round(curAccrued * 100) / 100,
        last_withdrawal_date: nowIso,
        updated_at: nowIso
      })
      .eq("id", targetUserId);

    // 7. Mark transaction completed (extra guard: only update if still pending)
    const { error: txUpdateErr } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "completed",
        approved_at: nowIso
      })
      .eq("id", transactionId)
      .eq("status", "pending");

    if (txUpdateErr) {
      console.error("[APPROVE WITHDRAWAL] Failed to update transaction:", txUpdateErr.message);
      res.writeHead(500, { "Content-Type": "text/html" });
      return res.end(htmlRedirectPage({
        title: "Approval Failed",
        message: "The balance was updated but the transaction could not be marked complete. Check Admin Portal and correct manually if needed.",
        success: false,
        appUrl
      }));
    }

    // 8. Create in-app notification for user
    try {
      await supabaseAdmin.from("notifications").insert({
        user_id: targetUserId,
        title: "Withdrawal Approved 🎉",
        message: `Your withdrawal of $${dbAmount.toFixed(2)} has been approved and processed.`,
        type: "withdrawal_approved",
        read: false
      });
    } catch (_) {
      // Non-critical, ignore
    }

    const investorName = uProf?.name || "Investor";
    console.log(`[APPROVE WITHDRAWAL] ✅ $${dbAmount} withdrawal approved for ${investorName} (tx: ${transactionId})`);

    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(htmlRedirectPage({
      title: "Withdrawal Approved!",
      message: `The withdrawal of <strong>$${dbAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong> for <strong>${investorName}</strong> has been approved. Their balance has been deducted. You can now manually transfer the Naira equivalent to their bank account.`,
      success: true,
      appUrl
    }));

  } catch (err) {
    console.error("[APPROVE WITHDRAWAL] Unhandled error:", err);
    res.writeHead(500, { "Content-Type": "text/html" });
    return res.end(htmlRedirectPage({
      title: "Server Error",
      message: `An unexpected error occurred: ${err.message}. Please approve via the Admin Portal.`,
      success: false,
      appUrl
    }));
  }
}
