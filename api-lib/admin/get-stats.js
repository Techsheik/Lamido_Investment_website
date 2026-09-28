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
      supabaseAdmin.from("investments").select("user_id, amount, status"),
      supabaseAdmin.from("transactions").select("type, amount, status"),
    ]);

    const totalUsers = usersRes.count || 0;
    
    // Group investments by user: prioritize active + approved to prevent doubling carry-forward
    const userInvsMap = new Map();
    for (const inv of (investmentsRes.data || [])) {
      if (!userInvsMap.has(inv.user_id)) {
        userInvsMap.set(inv.user_id, []);
      }
      userInvsMap.get(inv.user_id).push(inv);
    }

    let totalInvestments = 0;
    for (const [, uInvs] of userInvsMap.entries()) {
      const activeOrApproved = uInvs.filter(i => i.status === "active" || i.status === "approved");
      const currentPortfolio = activeOrApproved.length > 0
        ? activeOrApproved
        : uInvs.filter(i => i.status === "completed");
      totalInvestments += currentPortfolio.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    }

    // Only count completed/approved deposit and withdrawal transactions
    const approvedTransactions = (transactionsRes.data || []).filter(
      (t) => t.status === "completed" || t.status === "approved"
    );
    const deposits = approvedTransactions.filter(t => t.type === "deposit").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const withdrawals = approvedTransactions.filter(t => t.type === "withdrawal").reduce((sum, t) => sum + Number(t.amount || 0), 0);

    res.status(200).json({ totalUsers, totalInvestments, deposits, withdrawals });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: err.message });
  }
}
