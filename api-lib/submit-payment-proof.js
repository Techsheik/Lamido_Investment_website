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

    const { filePath, fileName, fileType, proofDescription, proofDate, transactionId } = req.body || {};

    if (!filePath || !fileName || !proofDescription) {
      return res.status(400).json({ error: "Missing required payment proof fields (filePath, fileName, proofDescription)" });
    }

    // 2. Fetch Profile & Transaction Details
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("name, user_code, email, phone")
      .eq("id", user.id)
      .single();

    if (profErr || !profile) {
      return res.status(404).json({ error: "User profile not found" });
    }

    let txAmount = null;
    if (transactionId) {
      const { data: tx } = await supabaseAdmin
        .from("transactions")
        .select("amount")
        .eq("id", transactionId)
        .maybeSingle();
      if (tx) {
        txAmount = tx.amount;
      }
    }

    // 3. Create transaction_proofs record
    const { data: proofData, error: proofErr } = await supabaseAdmin
      .from("transaction_proofs")
      .insert({
        user_id: user.id,
        transaction_id: transactionId || null,
        reference: transactionId || null,
        file_path: filePath,
        file_name: fileName,
        file_type: fileType || "application/octet-stream",
        status: "pending",
      })
      .select()
      .single();

    if (proofErr) {
      console.error("[SUBMIT PAYMENT PROOF DB ERROR]", proofErr.message);
      return res.status(500).json({ error: "Failed to record payment proof: " + proofErr.message });
    }

    // 4. Create in-app notification for admin/user tracking
    try {
      await supabaseAdmin.from("notifications").insert({
        user_id: user.id,
        title: "Payment Proof Submitted",
        message: `User ${profile.name} [${profile.user_code || "N/A"}] submitted payment proof on ${proofDate || "today"}: ${proofDescription}`,
        type: "payment_proof",
        read: false,
      });
    } catch (notifErr) {
      console.warn("[SUBMIT PAYMENT PROOF NOTIF WARN]", notifErr.message);
    }

    // 5. Send Executive Email Notification to Admin
    const emailResult = await sendAdminEmailNotification({
      type: "PAYMENT_PROOF_SUBMITTED",
      referenceId: transactionId || proofData.id,
      userId: user.id,
      metadata: {
        proofDate: proofDate || new Date().toISOString().split("T")[0],
        proofDescription,
        fileName,
        filePath,
        amount: txAmount,
      },
      idempotencyKey: `proof_${proofData.id}`,
      supabaseAdmin
    });

    console.log(`[SUBMIT PAYMENT PROOF] Email notification status: ${emailResult.status}`);

    return res.status(200).json({
      success: true,
      message: "Payment proof submitted successfully and admin notified via email.",
      proof: proofData,
      emailStatus: emailResult.status
    });

  } catch (error) {
    console.error("[SUBMIT PAYMENT PROOF UNHANDLED ERROR]", error);
    return res.status(500).json({ error: error.message || "An unexpected error occurred." });
  }
}
