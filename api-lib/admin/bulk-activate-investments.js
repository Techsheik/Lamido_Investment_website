import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const now = new Date();
    const endDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

    console.log("Bulk activating all pending investments...");

    const { data, error } = await supabaseAdmin
      .from("investments")
      .update({
        status: "active",
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
      })
      .in("status", ["pending", "approved"])
      .select();

    if (error) throw error;

    res.status(200).json({ ok: true, count: data ? data.length : 0 });
  } catch (err) {
    console.error("Error bulk activating investments:", err);
    res.status(500).json({ error: err.message });
  }
}
