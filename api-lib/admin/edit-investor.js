import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return res.status(500).json({ error: "Server misconfiguration: missing Supabase environment variables" });
    }

    const { investmentId, name, email, amount, units, status, start_date } = req.body;

    if (!investmentId) {
      return res.status(400).json({ error: "Missing investmentId" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Get current investment
    const { data: oldInv, error: fetchError } = await supabaseAdmin
      .from("investments")
      .select("*")
      .eq("id", investmentId)
      .single();

    if (fetchError) throw fetchError;

    const userId = oldInv.user_id;
    const UNIT_PRICE = 70;
    const calcUnits = Number(units) || Math.max(1, Math.round(Number(amount || 70) / UNIT_PRICE));
    const calcAmount = calcUnits * UNIT_PRICE;

    // 2. Update investment
    const updatePayload = {
      amount: calcAmount,
      units: calcUnits,
      start_date,
    };
    if (status) {
      updatePayload.status = status;
    }

    const { error: invUpdateError } = await supabaseAdmin
      .from("investments")
      .update(updatePayload)
      .eq("id", investmentId);

    if (invUpdateError) throw invUpdateError;

    // 3. Update profile if name/email changed
    if (userId && (name || email)) {
      const profileUpdates = {};
      if (name) profileUpdates.name = name;
      if (email) profileUpdates.email = email;

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", userId);

      if (profileError) console.error("Profile update error:", profileError);
    }

    res.status(200).json({ ok: true, message: "Investor updated successfully" });
  } catch (err) {
    console.error("Error editing investor:", err);
    res.status(500).json({ error: err.message });
  }
}
