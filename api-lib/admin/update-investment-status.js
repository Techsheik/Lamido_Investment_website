/**
 * POST /api/admin/update-investment-status
 *
 * Admin approves or rejects an investment.
 *
 * CRITICAL CHANGES:
 *  - Admin auth required
 *  - When status = 'approved': does NOT set start_date or end_date
 *    (dates are only set when admin starts the cycle via /api/admin/start-cycle)
 *  - Removes old roiAmount balance update (distributions handled by finalize-cycle-distribution)
 *  - Cannot change status of an investment in a FINALIZED cycle
 */

import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "./auth-check.js";

const ALLOWED_STATUSES = ["approved", "rejected", "suspended", "pending"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Verify admin
    const { adminUserId, error: authErr } = await verifyAdmin(req, supabaseAdmin);
    if (authErr) return res.status(authErr.status).json({ error: authErr.message });

    const { investmentId, status } = req.body;

    if (!investmentId) {
      return res.status(400).json({ error: "Missing investmentId" });
    }

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`
      });
    }

    // 2. Fetch existing investment
    const { data: existingInv, error: fetchError } = await supabaseAdmin
      .from("investments")
      .select("*, entry_windows:entry_id(id, status)")
      .eq("id", investmentId)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: "Investment not found" });
    }

    // 3. Prevent status changes on active investments (cycle is running)
    if (existingInv.status === "active" && status !== "suspended") {
      return res.status(400).json({
        error: "Cannot change status of an active investment while the cycle is running. You can only suspend it."
      });
    }

    // 4. Prevent status changes on completed investments
    if (existingInv.status === "completed" || existingInv.status === "rejected") {
      return res.status(400).json({
        error: `Cannot modify a ${existingInv.status} investment.`
      });
    }

    // 5. Build update fields
    // IMPORTANT: When approving, do NOT set start_date/end_date.
    // Dates are only set when admin explicitly starts the cycle via /api/admin/start-cycle.
    const updateFields = {
      status
    };

    // Auto-attach to active/open entry window if investment is approved and has no entry_id
    if (!existingInv.entry_id && status === "approved") {
      const { data: openEntry } = await supabaseAdmin
        .from("entry_windows")
        .select("id")
        .eq("status", "ENTRY_OPEN")
        .maybeSingle();

      if (openEntry?.id) {
        updateFields.entry_id = openEntry.id;
      }
    }

    // 6. Update investment
    const { data: investment, error: invError } = await supabaseAdmin
      .from("investments")
      .update(updateFields)
      .eq("id", investmentId)
      .select()
      .single();

    if (invError) throw invError;

    console.log(
      `[update-investment-status] Admin ${adminUserId} set investment ${investmentId} -> ${status}`
    );

    return res.status(200).json({
      ok: true,
      investment,
      message: status === "approved"
        ? "Investment approved. It will become active when the admin starts the cycle."
        : `Investment status updated to ${status}.`
    });

  } catch (err) {
    console.error("Error updating investment status:", err);
    return res.status(500).json({ error: err.message });
  }
}
