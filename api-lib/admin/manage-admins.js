import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { method } = req;
  try {
    if (method === "GET") {
      const { data, error } = await supabaseAdmin.from("user_roles").select("*, profiles(*)").eq("role", "admin");
      if (error) throw error;
      return res.status(200).json(data?.map(i => ({ ...i.profiles, role_id: i.id, user_id: i.user_id })) || []);
    }
    if (method === "POST") {
      const { action, userId, email } = req.body;
      if (action === "remove") {
        const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      if (action === "add") {
        const { data: p } = await supabaseAdmin.from("profiles").select("id").eq("email", email).single();
        if (!p) return res.status(404).json({ error: "User not found" });
        const { error } = await supabaseAdmin.from("user_roles").upsert({ user_id: p.id, role: "admin" });
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
    }
    return res.status(405).end();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
