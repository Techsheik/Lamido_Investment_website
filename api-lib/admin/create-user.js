import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { name, email, password, ...rest } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Missing required fields" });
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, user_metadata: { name }, email_confirm: true,
    });
    if (authError) throw authError;
    const { data: profile, error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: authData.user.id, name, email, ...rest
    }).select().single();
    if (profileError) throw profileError;
    res.status(200).json({ ok: true, data: profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
