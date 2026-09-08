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

    const { amount, paymentMethod, paymentInfo } = req.body || {};
    const withdrawalAmount = parseFloat(amount);

    // 2. Input Validation (positive number)
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      return res.status(400).json({ error: "Please enter a valid positive withdrawal amount greater than zero." });
    }

    if (!paymentMethod || !paymentMethod.trim()) {
      return res.status(400).json({ error: "Please select a payment method for your withdrawal." });
    }

    // 3. Fetch User Profile (Safely query profile & last withdrawal)
    let profile = null;
    try {
      const { data: profData } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      profile = profData;
    } catch (e) {
      // Ignore if single profile fetch warning
    }

    // Server-Side Validation: Ensure User has updated Phone & Bank Details in Profile
    const userPhone = (profile?.phone || "").trim();
    const bankName = (profile?.bank_name || "").trim();
    const accountNumber = (profile?.bank_account_number || profile?.account_number || "").trim();
    const accountHolderName = (profile?.account_holder_name || profile?.name || "").trim();

    if (!userPhone || userPhone.length < 5) {
      return res.status(400).json({
        error: "Missing Working Phone Number: Please update your Profile Settings with a valid working phone number so the admin can contact and verify your withdrawal."
      });
    }

    if (!bankName || !accountNumber) {
      return res.status(400).json({
        error: "Missing Bank Details: Please update your Bank Details (Bank Name, Account Number, Account Holder Name) in your Profile Settings before requesting a withdrawal."
      });
    }

    // Check 7-Day Frequency Rule if last_withdrawal_date exists
    if (profile?.last_withdrawal_date) {
      const lastWithdrawal = new Date(profile.last_withdrawal_date);
      const now = new Date();
      const daysSince = Math.floor((now.getTime() - lastWithdrawal.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince < 7) {
        const remaining = 7 - daysSince;
        return res.status(400).json({
          error: `Withdrawal limit reached. You can request a withdrawal once every 7 days. Next withdrawal available in ${remaining} day${remaining !== 1 ? "s" : ""}.`
        });
      }
    }

    // 4. Strict Available Balance & Accrued Return Validation
    const { data: investments, error: invErr } = await supabaseAdmin
      .from("investments")
      .select("*")
      .eq("user_id", user.id);

    if (invErr) throw invErr;

    const profileBalance = Number(profile?.balance || profile?.accrued_return || profile?.total_roi || 0);
    const activeAccrued = (investments || []).reduce((sum, inv) => {
      if (!inv.start_date) return sum;
      const startDate = new Date(inv.start_date);
      const now = new Date();
      const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysPassed >= 7 || inv.status === "completed") {
        const totalReturn = Number(inv.amount) * Number(inv.roi || 0) / 100;
        return sum + totalReturn;
      }
      return sum;
    }, 0);

    const availableBalance = Math.max(profileBalance, activeAccrued);

    // Reject if balance is zero or less
    if (availableBalance <= 0) {
      return res.status(400).json({
        error: "Insufficient funds. You do not have any available balance or accrued returns for withdrawal at this time."
      });
    }

    // Reject if requested amount exceeds available balance
    if (withdrawalAmount > availableBalance) {
      return res.status(400).json({
        error: `Insufficient funds. Requested amount ($${withdrawalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}) exceeds your available balance of $${availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`
      });
    }

    // 5. ALL VALIDATIONS PASSED -> Create Pending Withdrawal Transaction in Supabase
    const { data: transaction, error: txErr } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "withdrawal",
        amount: withdrawalAmount,
        status: "pending",
        date: new Date().toISOString()
      })
      .select()
      .single();

    if (txErr) throw txErr;

    // 6. Update Profile's Last Withdrawal Date (guarded in case column not yet created in DDL)
    try {
      await supabaseAdmin
        .from("profiles")
        .update({ last_withdrawal_date: new Date().toISOString() })
        .eq("id", user.id);
    } catch (e) {
      // Column may be pending DDL migration
    }

    // 7. Dispatch Executive Admin Email Notification
    const idempotencyKey = `withdrawal_${transaction.id}`;
    const emailResult = await sendAdminEmailNotification({
      type: "WITHDRAWAL_REQUEST",
      referenceId: transaction.id,
      userId: user.id,
      metadata: {
        amount: withdrawalAmount,
        payment_method: paymentMethod,
        payment_info: paymentInfo || paymentMethod,
        phone: userPhone,
        bank_name: bankName,
        account_number: accountNumber,
        account_holder_name: accountHolderName,
      },
      idempotencyKey,
      supabaseAdmin
    });

    return res.status(200).json({
      ok: true,
      data: transaction,
      notification: emailResult
    });

  } catch (err) {
    console.error("Request Withdrawal API Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
