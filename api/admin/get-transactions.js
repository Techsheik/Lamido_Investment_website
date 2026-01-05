import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { status, type, date } = req.query;

    let query = supabaseAdmin
      .from("transactions")
      .select(`
        *,
        profiles:user_id(name, user_code, balance, email),
        virtual_accounts(account_number, bank_name)
      `);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (type && type !== "all") {
      query = query.eq("type", type);
    }
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query = query.gte("created_at", startDate.toISOString())
                   .lte("created_at", endDate.toISOString());
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    res.status(200).json(data || []);
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({ error: err.message });
  }
}
