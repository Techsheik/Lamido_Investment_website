import { createClient } from "@supabase/supabase-js";
import { verifyUser } from "./admin/auth-check.js";
import { sendAdminEmailNotification } from "./email-service.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "Server misconfiguration: missing Supabase credentials" });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Server-Side Authentication
    const { user, error: authErr } = await verifyUser(req);
    if (authErr || !user) {
      return res.status(authErr?.status || 401).json({ error: authErr?.message || "Unauthorized" });
    }

    const { units } = req.body || {};
    const numUnits = Math.max(1, parseInt(units) || 1);
    const UNIT_PRICE = 70;
    const totalAmount = numUnits * UNIT_PRICE;

    // 2. Fetch Profile & Check Balance
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("balance, name, user_code, email")
      .eq("id", user.id)
      .single();

    if (profErr || !profile) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const userBalance = Number(profile.balance || 0);
    if (userBalance < totalAmount) {
      return res.status(400).json({
        error: `Insufficient balance ($${userBalance.toFixed(2)}). You need $${totalAmount.toFixed(2)} to purchase ${numUnits} share unit(s).`
      });
    }

    // 3. Find current open entry window to automatically link entry_id
    const { data: openEntry } = await supabaseAdmin
      .from("entry_windows")
      .select("id")
      .eq("status", "ENTRY_OPEN")
      .maybeSingle();

    const now = new Date();
    const startDate = now.toISOString();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 4. Create Investment Record
    const { data: invData, error: invErr } = await supabaseAdmin
      .from("investments")
      .insert({
        user_id: user.id,
        amount: totalAmount,
        units: numUnits,
        type: "Reinvestment Share Units",
        roi: 0,
        duration: 7,
        start_date: startDate,
        end_date: endDate,
        status: "pending",
        entry_id: openEntry?.id || null
      })
      .select()
      .single();

    if (invErr) throw invErr;

    // 5. Create Transaction Audit Record
    await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "reinvestment",
        amount: totalAmount,
        status: "completed",
        date: startDate,
        reference: `REINVEST-${invData.id.slice(0, 8)}`
      });

    // 6. Deduct Amount from User Profile Balance
    const newBalance = Math.max(0, userBalance - totalAmount);
    await supabaseAdmin
      .from("profiles")
      .update({
        balance: newBalance,
        updated_at: startDate
      })
      .eq("id", user.id);

    // 7. Dispatch Admin Email Notification for Reinvestment Request
    const idempotencyKey = `reinvest_${invData.id}_${now.getTime()}`;
    await sendAdminEmailNotification({
      type: "REINVESTMENT_REQUEST",
      referenceId: invData.id,
      userId: user.id,
      metadata: {
        amount: totalAmount,
        units: numUnits
      },
      idempotencyKey,
      supabaseAdmin
    });

    return res.status(200).json({
      success: true,
      message: "Reinvestment request submitted successfully",
      investmentId: invData.id,
      newBalance
    });

  } catch (err) {
    console.error("[SUBMIT REINVESTMENT ERROR]", err);
    return res.status(500).json({ error: err.message || "Failed to process reinvestment request" });
  }
}
