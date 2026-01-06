import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return res.status(500).json({ error: "Server misconfiguration: missing Supabase environment variables" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { id, ...inputData } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    // Handle both flat and nested structures (from AdminUserDetail.tsx)
    const updateData = {
      ...(inputData.profile || {}),
      ...(inputData.bank || {}),
      ...inputData
    };

    // Remove the nested objects if they exist
    delete updateData.profile;
    delete updateData.bank;

    console.log(`Updating profile for user ${id} with data:`, JSON.stringify(updateData));

    // Define allowed columns for profiles table to prevent Supabase errors
    const allowedColumns = [
      "name", "email", "phone", "balance", "total_roi", "roi_percentage",
      "weekly_roi_percentage", "account_status", "first_name", "middle_name",
      "surname", "country", "state", "lga", "profile_pic", "bank_name",
      "account_number", "account_holder_name", "accrued_return", "total_invested"
    ];

    const cleanedData = {};
    allowedColumns.forEach(col => {
      if (updateData[col] !== undefined) {
        cleanedData[col] = updateData[col];
      }
    });

    if (Object.keys(cleanedData).length === 0) {
      return res.status(200).json({ ok: true, message: "No changes to update" });
    }

    // Try update. If it fails due to missing column (cache not refreshed or migration not run),
    // we try again without the problematic column.
    let { data, error } = await supabaseAdmin
      .from("profiles")
      .update(cleanedData)
      .eq("id", id)
      .select()
      .single();

    if (error && error.message.includes("total_invested")) {
      console.warn("Retrying update without total_invested column...");
      delete cleanedData.total_invested;
      const retry = await supabaseAdmin
        .from("profiles")
        .update(cleanedData)
        .eq("id", id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("Error updating profile in Supabase:", error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`Successfully updated profile for user ${id}`);
    res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("Unexpected error in update-user:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
