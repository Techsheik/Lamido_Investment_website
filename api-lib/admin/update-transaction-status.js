import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id, status, adminId, amount, type, userId, currentBalance } = req.body;

    if (!id || !status) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Update transaction status
    const { data: transaction, error: transError } = await supabaseAdmin
      .from("transactions")
      .update({ 
        status: status === "approved" ? "completed" : status,
        approved_at: new Date().toISOString(),
        approved_by: adminId 
      })
      .eq("id", id)
      .select()
      .single();

    if (transError) throw transError;

    // 2. Logic for approved transactions
    if (status === "approved" && userId) {
      if (type === "deposit") {
        // Add to balance
        const newBalance = Number(currentBalance || 0) + Number(amount);
        const { error: balanceError } = await supabaseAdmin
          .from("profiles")
          .update({ balance: newBalance })
          .eq("id", userId);

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
          .eq("user_id", userId)
          .eq("status", "pending");

      } else if (type === "withdrawal") {
        // Deduct from balance
        const newBalance = Number(currentBalance || 0) - Number(amount);
        const { error: balanceError } = await supabaseAdmin
          .from("profiles")
          .update({ balance: newBalance })
          .eq("id", userId);

        if (balanceError) throw balanceError;
      }
    }

    res.status(200).json({ ok: true, transaction });
  } catch (err) {
    console.error("Error updating transaction:", err);
    res.status(500).json({ error: err.message });
  }
}
