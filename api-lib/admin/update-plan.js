import { createClient } from "@supabase/supabase-js";

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

    const { id, ...payload } = req.body;

    if (id) {
      // Update
      const { data, error } = await supabaseAdmin
        .from("investment_plans")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ ok: true, data });
    } else {
      // Create
      const { data, error } = await supabaseAdmin
        .from("investment_plans")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ ok: true, data });
    }
  } catch (err) {
    console.error("Error in update-plan:", err);
    res.status(500).json({ error: err.message });
  }
}
