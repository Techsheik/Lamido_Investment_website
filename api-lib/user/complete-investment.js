import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { investmentId, userId } = req.body;

    if (!investmentId || !userId) {
      return res.status(400).json({ error: "Missing investmentId or userId" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Fetch the investment and verify ownership
    const { data: investment, error: fetchError } = await supabaseAdmin
      .from("investments")
      .select("*, profiles:user_id(*)")
      .eq("id", investmentId)
      .single();

    if (fetchError || !investment) {
      return res.status(404).json({ error: "Investment not found" });
    }

    if (investment.user_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (investment.status !== "active" && investment.status !== "suspended") {
      return res.status(400).json({ error: "Only active or suspended investments can be completed" });
    }

    // 2. Calculate ROI
    const roiPercentage = investment.roi || investment.profiles?.weekly_roi_percentage || 10;
    const capital = Number(investment.amount);
    const roiAmount = capital * (Number(roiPercentage) / 100);
    const totalReturn = capital + roiAmount;

    console.log(`[User API] Completing investment ${investmentId} for user ${userId}. Returning ${totalReturn} (Cap: ${capital}, ROI: ${roiAmount})`);

    // 3. Update user profile balance and total ROI
    const currentBalance = Number(investment.profiles?.balance || 0);
    const currentTotalROI = Number(investment.profiles?.total_roi || 0);
    
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ 
        balance: currentBalance + totalReturn,
        total_roi: currentTotalROI + roiAmount
      })
      .eq("id", userId);

    if (profileError) throw profileError;

    // 4. Set investment status to completed
    const { error: updateError } = await supabaseAdmin
      .from("investments")
      .update({ status: "completed" })
      .eq("id", investmentId);

    if (updateError) throw updateError;

    // 5. Notify admin
    await supabaseAdmin.from("notifications").insert({
      title: "User Terminated Investment",
      message: `User ${investment.profiles?.name} (${userId}) manually completed their investment of $${capital}. Total returned to balance: $${totalReturn.toFixed(2)}.`,
      type: "info",
      user_id: userId,
      read: false,
    });

    res.status(200).json({ ok: true, returnedAmount: totalReturn });
  } catch (err) {
    console.error("Error completing investment:", err);
    res.status(500).json({ error: err.message });
  }
}
