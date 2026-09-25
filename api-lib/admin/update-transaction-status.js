import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "./auth-check.js";

/**
 * Helper: build a safe update payload.
 * Tries to include approved_at / approved_by. If the DB throws a "column not found"
 * error, the caller retries without those columns.
 */
function buildUpdatePayload(status, adminUserId, includeApprovalMeta = true) {
  const payload = { status };
  if (includeApprovalMeta) {
    payload.approved_at = new Date().toISOString();
    payload.approved_by = adminUserId;
  }
  return payload;
}

function isColumnMissingError(err) {
  const msg = (err?.message || "").toLowerCase();
  return (
    msg.includes("approved_at") ||
    msg.includes("approved_by") ||
    msg.includes("schema cache") ||
    msg.includes("column") ||
    msg.includes("does not exist")
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // SECURITY: Verify admin JWT before allowing any status changes
    const { adminUserId, error: authErr } = await verifyAdmin(req, supabaseAdmin);
    if (authErr) {
      return res.status(authErr.status).json({ error: authErr.message });
    }

    const { id, status, userId, type } = req.body;

    if (!id || !status) {
      return res.status(400).json({ error: "Missing required fields: id and status" });
    }

    // 1. Fetch the transaction from DB first — use DB values, never trust client-supplied amounts
    const { data: existingTx, error: fetchErr } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !existingTx) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Idempotency: already in target state
    if ((existingTx.status === "completed" || existingTx.status === "approved") && status === "approved") {
      return res.status(200).json({ ok: true, message: "Transaction already approved or completed", transaction: existingTx });
    }

    const targetUserId = existingTx.user_id || userId;
    // SECURITY: Always use DB amount, never the client-supplied amount
    const dbAmount = Number(existingTx.amount || 0);
    const txType = existingTx.type || type;

    /**
     * Safe update helper — tries with approval metadata first.
     * If DB doesn't have approved_at/approved_by columns yet, retries without them.
     */
    async function safeUpdateTx(newStatus) {
      // Try with metadata
      let payload = buildUpdatePayload(newStatus, adminUserId, true);
      let { data, error } = await supabaseAdmin
        .from("transactions")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (error && isColumnMissingError(error)) {
        console.warn("[update-transaction-status] approved_at/approved_by columns missing, retrying without them...");
        payload = buildUpdatePayload(newStatus, adminUserId, false);
        const retry = await supabaseAdmin
          .from("transactions")
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      return { data, error };
    }

    // ── WITHDRAWAL APPROVAL ──────────────────────────────────────────────────────
    // For withdrawals, "approve" only marks the transaction as "approved".
    // Balance deduction happens ONLY after admin confirms payment via
    // POST /api/admin/confirm-withdrawal-paid — deliberate two-step process.
    if (status === "approved" && txType === "withdrawal") {
      const { data: transaction, error: transError } = await safeUpdateTx("approved");
      if (transError) throw transError;

      console.log(`[update-transaction-status] Admin ${adminUserId} APPROVED withdrawal tx ${id} (payment pending)`);
      return res.status(200).json({
        ok: true,
        transaction,
        message: "Withdrawal approved. Please manually transfer the funds, then click \"Confirm Paid\" to deduct the balance."
      });
    }

    // ── DEPOSIT APPROVAL / REJECTION ─────────────────────────────────────────────
    // For deposits, "approve" = "completed" + credit balance immediately.
    const newStatus = status === "approved" ? "completed" : status;

    const { data: transaction, error: transError } = await safeUpdateTx(newStatus);
    if (transError) throw transError;

    // Credit balance for approved deposits
    if (status === "approved" && txType === "deposit" && targetUserId) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("balance")
        .eq("id", targetUserId)
        .maybeSingle();

      const newBalance = Number(prof?.balance || 0) + dbAmount;
      const { error: balanceError } = await supabaseAdmin
        .from("profiles")
        .update({ balance: Math.round(newBalance * 100) / 100 })
        .eq("id", targetUserId);

      if (balanceError) throw balanceError;

      // Activate any pending investments for this user
      const now = new Date();
      const endDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
      await supabaseAdmin
        .from("investments")
        .update({
          status: "active",
          start_date: now.toISOString(),
          end_date: endDate.toISOString(),
        })
        .eq("user_id", targetUserId)
        .eq("status", "pending");
    }

    console.log(`[update-transaction-status] Admin ${adminUserId} set tx ${id} → ${newStatus}`);
    res.status(200).json({ ok: true, transaction });
  } catch (err) {
    console.error("Error updating transaction:", err);
    res.status(500).json({ error: err.message });
  }
}
