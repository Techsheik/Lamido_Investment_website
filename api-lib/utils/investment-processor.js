import { createClient } from "@supabase/supabase-js";

export async function processMaturedInvestments(supabaseAdmin) {
  const now = new Date();
  console.log(`[Processor] Checking for matured investments at ${now.toISOString()}...`);

  // 1. Fetch all active investments that have passed their end_date
  const { data: maturedInvestments, error } = await supabaseAdmin
    .from("investments")
    .select(`
      *,
      profiles:user_id(id, name, balance, weekly_roi_percentage)
    `)
    .eq("status", "active")
    .lte("end_date", now.toISOString());

  if (error) {
    console.error("[Processor] Error fetching matured investments:", error);
    return;
  }

  if (!maturedInvestments || maturedInvestments.length === 0) {
    console.log("[Processor] No matured investments found.");
    return;
  }

  console.log(`[Processor] Found ${maturedInvestments.length} matured investments to process.`);

  for (const inv of maturedInvestments) {
    try {
      const roiPercentage = inv.roi || inv.profiles?.weekly_roi_percentage || 10;
      const accruedAmount = Number(inv.amount) * (Number(roiPercentage) / 100);
      const profile = inv.profiles;

      console.log(`[Processor] Processing investment ${inv.id} for user ${profile?.name}. Accrued: ${accruedAmount}`);

      // 2. Update user profile: balance and total_roi
      const currentBalance = Number(profile?.balance || 0);
      const currentTotalROI = Number(profile?.total_roi || 0);
      const newBalance = currentBalance + accruedAmount;
      const newTotalROI = currentTotalROI + accruedAmount;

      const { error: profileUpdateError } = await supabaseAdmin
        .from("profiles")
        .update({ 
          balance: newBalance,
          total_roi: newTotalROI
        })
        .eq("id", inv.user_id);

      if (profileUpdateError) throw profileUpdateError;

      // 3. Create notification for admin
      const { error: notifyError } = await supabaseAdmin.from("notifications").insert({
        title: "Investment Matured & Auto-Renewed",
        message: `Investment of $${inv.amount} for user ${profile?.name} (${inv.user_id}) has matured. Accrued ROI: $${accruedAmount.toFixed(2)}. The investment has been reset for a new cycle.`,
        type: "success",
        user_id: inv.user_id, // We associate it with the user, but admins can see it
        read: false,
      });

      if (notifyError) console.error("[Processor] Notification error:", notifyError);

      // 4. Reset investment for next cycle
      const duration = inv.duration || 7;
      const nextStartDate = new Date();
      const nextEndDate = new Date(nextStartDate.getTime() + (duration * 24 * 60 * 60 * 1000));

      const { error: updateError } = await supabaseAdmin
        .from("investments")
        .update({
          start_date: nextStartDate.toISOString(),
          end_date: nextEndDate.toISOString(),
          // keep status as active
        })
        .eq("id", inv.id);

      if (updateError) throw updateError;

      console.log(`[Processor] Successfully processed and renewed investment ${inv.id}`);
    } catch (err) {
      console.error(`[Processor] Failed to process investment ${inv.id}:`, err);
    }
  }
}
