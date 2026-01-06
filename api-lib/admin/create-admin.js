import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
  try {
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) return res.status(400).json({ error: "Missing required fields" });

    // 1. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      email_confirm: true,
    });

    if (authError) throw authError;

    // 2. Profile and Role
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: authData.user.id, name, email, account_status: "active" });

    if (profileError) throw profileError;

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: authData.user.id, role: "admin" }, { onConflict: "user_id,role" });

    if (roleError) throw roleError;

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
