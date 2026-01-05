import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { investmentId } = req.body;

    if (!investmentId) {
      return res.status(400).json({ error: "Missing investmentId" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log(`Deleting investment ${investmentId}...`);

    const { error } = await supabaseAdmin
      .from("investments")
      .delete()
      .eq("id", investmentId);

    if (error) throw error;

    res.status(200).json({ ok: true, message: "Investment deleted successfully" });
  } catch (err) {
    console.error("Error deleting investment:", err);
    res.status(500).json({ error: err.message });
  }
}
