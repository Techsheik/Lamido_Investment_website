import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { method } = req;
  try {
    if (method === "GET") {
      const { data, error } = await supabaseAdmin.from("announcements").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    if (method === "POST") {
      const { data, error } = await supabaseAdmin.from("announcements").insert(req.body).select().single();
      if (error) throw error;
      return res.status(200).json({ ok: true, data });
    }
    if (method === "PUT") {
      const { id, ...rest } = req.body;
      const { data, error } = await supabaseAdmin.from("announcements").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      return res.status(200).json({ ok: true, data });
    }
    if (method === "DELETE") {
      const { error } = await supabaseAdmin.from("announcements").delete().eq("id", req.body.id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
