import { createClient } from "@supabase/supabase-js";
import { verifyUser } from "./admin/auth-check.js";

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
    const { user, error: authErr } = await verifyUser(req);
    if (authErr || !user) {
      return res.status(authErr?.status || 401).json({ error: authErr?.message || "Unauthorized" });
    }

    const { phone, bank_name, account_number, account_holder_name, routing_number } = req.body || {};

    const phoneTrim = (phone || "").trim();
    const bankNameTrim = (bank_name || "").trim();
    const accNumTrim = (account_number || "").trim();
    const accHolderTrim = (account_holder_name || "").trim();

    if (!phoneTrim || phoneTrim.length < 5) {
      return res.status(400).json({ error: "Please provide a valid Working Phone Number (minimum 5 digits)." });
    }
    if (!bankNameTrim || !accNumTrim || !accHolderTrim) {
      return res.status(400).json({ error: "Please provide complete Bank Details (Bank Name, Account Number, Account Holder Name)." });
    }

    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        phone: phoneTrim,
        bank_name: bankNameTrim,
        bank_account_number: accNumTrim,
        account_number: accNumTrim,
        account_holder_name: accHolderTrim,
        routing_number: (routing_number || "").trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (updateErr) throw updateErr;

    return res.status(200).json({
      ok: true,
      message: "Profile and payment details updated successfully"
    });
  } catch (err) {
    console.error("Update Profile Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
