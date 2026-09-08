import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "Server missing Supabase service configuration" });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { method } = req;

  try {
    if (method === "GET") {
      // 1. Fetch raw complaints
      const { data: complaints, error: compErr } = await supabaseAdmin
        .from("complaints")
        .select("*")
        .order("created_at", { ascending: false });

      if (compErr) throw compErr;
      if (!complaints || complaints.length === 0) {
        return res.status(200).json([]);
      }

      // 2. Fetch associated user profiles via manual join (bypassing foreign key constraints)
      const userIds = Array.from(new Set(complaints.map((c) => c.user_id).filter(Boolean)));
      let profileMap = new Map();

      if (userIds.length > 0) {
        const { data: profiles, error: profErr } = await supabaseAdmin
          .from("profiles")
          .select("id, name, email, phone, country, user_code")
          .in("id", userIds);

        if (profErr) {
          console.warn("Could not fetch user profiles for complaints:", profErr.message);
        } else if (profiles) {
          profiles.forEach((p) => profileMap.set(p.id, p));
        }
      }

      // 3. Map complaints with attached user profile
      const joinedComplaints = complaints.map((c) => ({
        ...c,
        profiles: profileMap.get(c.user_id) || {
          id: c.user_id,
          name: "Unknown User",
          email: "N/A",
          phone: "N/A",
          country: "N/A",
          user_code: "N/A",
        },
      }));

      return res.status(200).json(joinedComplaints);
    }

    if (method === "POST" || method === "PUT") {
      const { id, status } = req.body;
      if (!id || !status) {
        return res.status(400).json({ error: "id and status are required" });
      }

      const { data, error } = await supabaseAdmin
        .from("complaints")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ ok: true, data });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Complaints API Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
