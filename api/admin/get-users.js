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
      const { data: investments, error: invError } = await supabaseAdmin
        .from("investments")
        .select("user_id, amount, roi")
        .in("user_id", userIds);

      if (invError) throw invError;

      const invMap = investments?.reduce((acc, inv) => {
        if (!acc[inv.user_id]) acc[inv.user_id] = [];
        acc[inv.user_id].push(inv);
        return acc;
      }, {}) || {};

      const mappedUsers = profiles.map(user => ({
        ...user,
        totalInvested: invMap[user.id]?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0,
        totalROI: invMap[user.id]?.reduce((sum, inv) => sum + Number(inv.roi), 0) || 0,
      }));

      return res.status(200).json(mappedUsers);
    }

    res.status(200).json(profiles || []);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: err.message });
  }
}
