import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return res.status(500).json({ error: "Server misconfiguration: missing Supabase environment variables" });
    }

    const { investmentId, name, email, amount, roi_percentage, plan_id, start_date } = req.body;

    if (!investmentId) {
      return res.status(400).json({ error: "Missing investmentId" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Get current investment to find user_id and old amount
    const { data: oldInv, error: fetchError } = await supabaseAdmin
      .from("investments")
      .select("*, profiles:user_id(balance)")
      .eq("id", investmentId)
      .single();

    if (fetchError) throw fetchError;

    const userId = oldInv.user_id;
    const oldAmount = Number(oldInv.amount || 0);
    const amountDifference = Number(amount) - oldAmount;

    // 2. Update investment
    const { error: invUpdateError } = await supabaseAdmin
      .from("investments")
      .update({
        amount: Number(amount),
        roi: Number(roi_percentage),
        start_date,
        plan_id,
      })
      .eq("id", investmentId);

    if (invUpdateError) throw invUpdateError;

    // 3. Update profile and balance
    if (userId) {
      const currentBalance = Number(oldInv.profiles?.balance || 0);
      const newBalance = currentBalance + amountDifference;

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          name,
          email,
          balance: newBalance,
          weekly_roi_percentage: Number(roi_percentage),
          roi_percentage: Number(roi_percentage),
        })
        .eq("id", userId);

      if (profileError) throw profileError;
    }

    res.status(200).json({ ok: true, message: "Investor updated successfully" });
  } catch (err) {
    console.error("Error editing investor:", err);
    res.status(500).json({ error: err.message });
  }
}
