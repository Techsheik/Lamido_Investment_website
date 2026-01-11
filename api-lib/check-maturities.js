import { createClient } from "@supabase/supabase-js";
import { processMaturedInvestments } from "./utils/investment-processor.js";

export default async function handler(req, res) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    await processMaturedInvestments(supabaseAdmin);

    res.status(200).json({ status: "success" });
  } catch (err) {
    console.error("Error in check-maturities handler:", err);
    res.status(500).json({ error: err.message });
  }
}
