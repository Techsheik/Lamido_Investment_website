import { createClient } from "@supabase/supabase-js";
import { getCycleDurationMs } from "./cycle-config.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Server misconfiguration: missing Supabase credentials" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const cycleDurationMs = getCycleDurationMs();

    // 1. Delete all investments
    await supabaseAdmin.from("investments").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 2. Delete all transactions
    await supabaseAdmin.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 3. Reset user profiles balance and ROI to 0
    await supabaseAdmin.from("profiles").update({
      balance: 0,
      total_roi: 0,
      accrued_return: 0
    }).neq("id", "00000000-0000-0000-0000-000000000000");

    // 4. Clear stored cycles and distributions in platform_settings
    const nowIso = new Date().toISOString();
    const freshCycle = [{
      id: `cycle-1-${Date.now()}`,
      cycle_number: 1,
      name: "Cycle #1",
      start_date: nowIso,
      end_date: new Date(Date.now() + cycleDurationMs).toISOString(),
      status: "ACTIVE",
      community_profit: 0,
      eligible_units: 0,
      ppsu: 0,
      created_at: nowIso
    }];

    await supabaseAdmin.from("platform_settings").upsert({
      setting_key: "investment_cycles_data",
      setting_value: JSON.stringify(freshCycle),
      updated_at: nowIso
    }, { onConflict: "setting_key" });

    await supabaseAdmin.from("platform_settings").upsert({
      setting_key: "cycle_distributions_data",
      setting_value: JSON.stringify([]),
      updated_at: nowIso
    }, { onConflict: "setting_key" });

    res.status(200).json({
      success: true,
      message: "All investments, deposits, withdrawals, balances, and cycle distributions have been reset to zero."
    });
  } catch (err) {
    console.error("Error in reset-investments handler:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
