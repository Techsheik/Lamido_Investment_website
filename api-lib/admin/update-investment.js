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

    const { id, ...updateData } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing investment ID" });
    }

    console.log(`Updating investment ${id} with data:`, JSON.stringify(updateData));

    // Remove any fields that shouldn't be updated or might cause issues
    const cleanedData = { ...updateData };
    delete cleanedData.id;
    delete cleanedData.created_at;
    delete cleanedData.updated_at;

    const { data, error } = await supabaseAdmin
      .from("investments")
      .update(cleanedData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating investment in Supabase:", error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`Successfully updated investment ${id}`);
    res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("Unexpected error in update-investment:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
