import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Parse userId from query params or URL
  let userId = req.query?.userId;
  if (!userId && req.url) {
    try {
      const parsedUrl = new URL(req.url, "http://localhost");
      userId = parsedUrl.searchParams.get("userId");
    } catch (e) {}
  }

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

    const { data: distributions } = await supabaseAdmin
      .from("cycle_distributions")
      .select("profit")
      .eq("user_id", userId);

    // Calculate dynamic stats
    const activeInvestments = investments?.filter(i => ["active", "approved", "completed"].includes(i.status)) || [];
    const totalInvested = activeInvestments.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const totalROI = (distributions || []).reduce((sum, dist) => sum + Number(dist.profit || 0), 0);

    const enhancedProfile = {
      ...profile,
      total_invested: totalInvested,
      totalInvested: totalInvested,
      total_roi: totalROI,
      totalROI: totalROI,
    };

    res.status(200).json({
      profile: enhancedProfile,
      transactions: transactions || [],
      investments: investments || []
    });
  } catch (err) {
    console.error("get-user-detail error:", err);
    res.status(500).json({ error: err.message });
  }
}
