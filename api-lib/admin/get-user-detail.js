import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { userId } = req.query;

  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError) throw profileError;

    const { data: transactions, error: transError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (transError) throw transError;

    const { data: investments, error: invError } = await supabaseAdmin
      .from("investments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (invError) throw invError;

    res.status(200).json({
      profile,
      transactions,
      investments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
