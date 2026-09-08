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
    // 1. Authenticate User
    const { user, error: authErr } = await verifyUser(req);
    if (authErr || !user) {
      return res.status(authErr?.status || 401).json({ error: authErr?.message || "Unauthorized" });
    }

    const { title, description, category } = req.body || {};

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Complaint title is required." });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ error: "Complaint description is required." });
    }

    // 2. Insert Complaint into database
    const { data: complaint, error: compErr } = await supabaseAdmin
      .from("complaints")
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        category: category || "general",
        status: "open",
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (compErr) throw compErr;

    // 3. Trigger Admin Email Notification (non-blocking failure)
    const idempotencyKey = `complaint_${complaint.id}`;
    const emailResult = await sendAdminEmailNotification({
      type: "COMPLAINT_SUBMITTED",
      referenceId: complaint.id,
      userId: user.id,
      metadata: {
        title: title.trim(),
        description: description.trim(),
        category: category || "general"
      },
      idempotencyKey,
      supabaseAdmin
    });

    return res.status(200).json({
      ok: true,
      data: complaint,
      notification: emailResult
    });

  } catch (err) {
    console.error("Submit Complaint API Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
