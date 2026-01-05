import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { investmentId, status, roiAmount } = req.body;

    if (!investmentId || !status) {
      return res.status(400).json({ error: "Missing investmentId or status" });
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log(`Updating investment ${investmentId} to status ${status}...`);

    // 1. Update investment status
    const { data: investment, error: invError } = await supabaseAdmin
      .from("investments")
      .update({ status })
      .eq("id", investmentId)
      .select("*, profiles:user_id(balance)")
      .single();

    if (invError) throw invError;

    // 2. If status is completed, add ROI to user balance
    if (status === "completed" && roiAmount) {
      const currentBalance = Number(investment.profiles?.balance || 0);
      const newBalance = currentBalance + Number(roiAmount);

      const { error: balanceError } = await supabaseAdmin
        .from("profiles")
        .update({ balance: newBalance })
        .eq("id", investment.user_id);

      if (balanceError) throw balanceError;
    }

    // 3. If status is rejected and it was pending, we might need to refund? 
    // (Current logic in frontend doesn't seem to refund on reject unless specific conditions met)

    res.status(200).json({ ok: true, investment });
  } catch (err) {
    console.error("Error updating investment status:", err);
    res.status(500).json({ error: err.message });
  }
}
