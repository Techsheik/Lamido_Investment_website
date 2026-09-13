import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "./auth-check.js";

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
    if (existingTx.status === "completed" && status === "approved") {
      return res.status(200).json({ ok: true, message: "Transaction already completed", transaction: existingTx });
    }

    // 2. Update transaction status
    const { data: transaction, error: transError } = await supabaseAdmin
      .from("transactions")
      .update({
        status: status === "approved" ? "completed" : status,
        approved_at: new Date().toISOString(),
        approved_by: adminUserId
      })
      .eq("id", id)
      .select()
      .single();

    if (transError) throw transError;

    const targetUserId = existingTx.user_id || userId;
    // SECURITY: Always use DB amount, never the client-supplied amount
    const dbAmount = Number(existingTx.amount || 0);
    const txType = existingTx.type || type;

    // 3. Logic for approved transactions
    if (status === "approved" && targetUserId) {
      if (txType === "deposit") {
        // Fetch current balance from DB
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

        // Activate pending investment
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

      } else if (txType === "withdrawal") {
        // Deduct approved withdrawal amount — use DB amount only
        const { data: uProf } = await supabaseAdmin
          .from("profiles")
          .select("balance, accrued_return")
          .eq("id", targetUserId)
          .single();

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

        await supabaseAdmin
          .from("profiles")
          .update({
            balance: Math.round(curBal * 100) / 100,
            accrued_return: Math.round(curAccrued * 100) / 100,
            last_withdrawal_date: new Date().toISOString()
          })
          .eq("id", targetUserId);
      }
    }

    console.log(`[update-transaction-status] Admin ${adminUserId} set tx ${id} → ${status}`);
    res.status(200).json({ ok: true, transaction });
  } catch (err) {
    console.error("Error updating transaction:", err);
    res.status(500).json({ error: err.message });
  }
}

