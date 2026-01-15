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

    const updateFields = { status };
    if (status === "active") {
      const now = new Date();
      updateFields.start_date = now.toISOString();
      // Most plans are 7 days based on the migrations and UI
      const duration = 7;
      const endDate = new Date(now.getTime() + (duration * 24 * 60 * 60 * 1000));
      updateFields.end_date = endDate.toISOString();
    }

    // Special handling for RENEWAL when status is set to "completed"
    if (status === "completed") {
      const now = new Date();
      updateFields.status = "active"; // Keep it active for the next cycle
      updateFields.start_date = now.toISOString();
      const duration = 7; // Default duration
      const endDate = new Date(now.getTime() + (duration * 24 * 60 * 60 * 1000));
      updateFields.end_date = endDate.toISOString();
    }

    // 1. Update investment status
    const { data: investment, error: invError } = await supabaseAdmin
      .from("investments")
      .update(updateFields)
      .eq("id", investmentId)
      .select("*, profiles:user_id(balance, total_roi)")
      .single();

    if (invError) throw invError;

    // 2. If status was originally completed, add ROI to user balance
    if (status === "completed" && roiAmount) {
      const currentBalance = Number(investment.profiles?.balance || 0);
      const currentTotalROI = Number(investment.profiles?.total_roi || 0);
      const newBalance = currentBalance + Number(roiAmount);
      const newTotalROI = currentTotalROI + Number(roiAmount);

      const { error: balanceError } = await supabaseAdmin
        .from("profiles")
        .update({ 
          balance: newBalance,
          total_roi: newTotalROI
        })
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
