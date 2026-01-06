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

    const [usersRes, investmentsRes, transactionsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact" }),
      supabaseAdmin.from("investments").select("amount"),
      supabaseAdmin.from("transactions").select("type, amount"),
    ]);

    const totalUsers = usersRes.count || 0;
    const totalInvestments = investmentsRes.data?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
    const deposits = transactionsRes.data?.filter(t => t.type === "deposit").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const withdrawals = transactionsRes.data?.filter(t => t.type === "withdrawal").reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    res.status(200).json({ totalUsers, totalInvestments, deposits, withdrawals });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: err.message });
  }
}
