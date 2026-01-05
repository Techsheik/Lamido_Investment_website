import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Fail fast if Supabase env vars are not set
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Server misconfiguration: missing Supabase environment variables" });
    }

    // Initialize Supabase admin client with service role key
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("Fetching all investments via Admin API (bypassing RLS)...");

    // Fetch all investments with profiles and plans
    const { data, error } = await supabaseAdmin
      .from("investments")
      .select(`
        *,
        profiles:user_id(
          id, 
          name, 
          email, 
          balance, 
          weekly_roi_percentage, 
          user_code,
          account_holder_name,
          bank_name,
          bank_account_number,
          routing_number
        ),
        investment_plans(name, roi_percentage)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching investments via Admin API:", error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`Successfully fetched ${data?.length} investments`);
    if (data && data.length > 0) {
      console.log("Sample investment user_id:", data[0].user_id);
      console.log("Sample profile info:", data[0].profiles ? "Found" : "Missing");
    }

    // Success response
    res.status(200).json(data || []);
  } catch (err) {
    console.error("Unexpected error in get-investments:", err);
    res.status(500).json({
      error: err.message || "Internal server error",
    });
  }
}
