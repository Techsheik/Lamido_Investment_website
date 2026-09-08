import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return res.status(500).json({ error: "Server misconfiguration: missing Supabase environment variables" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch all profiles
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profileError) throw profileError;

    if (profiles && profiles.length > 0) {
      const userIds = profiles.map(u => u.id);
      
      // Fetch investments for these users to calculate stats
      const { data: investments } = await supabaseAdmin
        .from("investments")
        .select("user_id, amount, status")
        .in("user_id", userIds)
        .in("status", ["active", "approved", "completed"]);

      // Fetch cycle distributions for these users to calculate real profit earned
      const { data: distributions } = await supabaseAdmin
        .from("cycle_distributions")
        .select("user_id, profit")
        .in("user_id", userIds);

      const invMap = investments?.reduce((acc, inv) => {
        acc[inv.user_id] = (acc[inv.user_id] || 0) + Number(inv.amount || 0);
        return acc;
      }, {}) || {};

      const distMap = distributions?.reduce((acc, dist) => {
        acc[dist.user_id] = (acc[dist.user_id] || 0) + Number(dist.profit || 0);
        return acc;
      }, {}) || {};

      const mappedUsers = profiles.map(user => {
        const totalInvested = invMap[user.id] || 0;
        const totalROI = distMap[user.id] || 0;
        return {
          ...user,
          total_invested: totalInvested,
          totalInvested: totalInvested,
          total_roi: totalROI,
          totalROI: totalROI,
        };
      });

      return res.status(200).json(mappedUsers);
    }

    res.status(200).json(profiles || []);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: err.message });
  }
}
