import { createClient } from "@supabase/supabase-js";

function generateUserCode(name) {
  const initials = name
    .split(" ")
    .map((n) => n.charAt(0).toUpperCase())
    .join("")
    .substring(0, 2);
  const date = new Date().toLocaleDateString("en-GB").replace(/\//g, "");
  const timestamp = Date.now().toString().slice(-4);
  return `${initials}${date}${timestamp}`;
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Fail fast if Supabase env vars are not set
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Server misconfiguration: missing Supabase env vars");
      console.error(`  SUPABASE_URL: ${process.env.SUPABASE_URL ? 'set' : 'MISSING'}`);
      console.error(`  SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING'}`);
      return res.status(500).json({ error: "Server misconfiguration: missing Supabase environment variables" });
    }

    // Initialize Supabase admin client with service role key (do this after env check)
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { name, email, amount, roi_percentage, plan_id, start_date } = req.body;

    // Validate inputs
    if (!name || !email || !amount || roi_percentage === undefined || !start_date) {
      return res.status(400).json({
        error: "Missing required fields: name, email, amount, roi_percentage, start_date",
      });
    }

    // Step 1: Check if user exists or create new auth user
    let userId;
    let isNewUser = false;

    // Check if profile already exists with this email
    const { data: existingProfile, error: profileSearchError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (profileSearchError) {
      console.error("Error searching for existing profile:", profileSearchError);
    }

    if (existingProfile) {
      userId = existingProfile.id;
      console.log(`Found existing user with ID: ${userId}`);
    } else {
      // Try to create auth user using admin API
      const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        user_metadata: { name },
        email_confirm: true, // Auto-confirm email
      });

      if (authError) {
        // If user already exists in Auth but not in Profiles (edge case)
        const errorMsg = authError.message.toLowerCase();
        if (errorMsg.includes("already registered") || errorMsg.includes("already being registered") || errorMsg.includes("email exists")) {
          // We need to find the user ID from Auth since they aren't in Profiles
          const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          const authUser = usersData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
          
          if (authUser) {
            userId = authUser.id;
            console.log(`Found existing Auth user (no profile) with ID: ${userId}`);
          } else {
            console.error("Auth creation error (already exists but not found):", authError);
            return res.status(400).json({
              error: `User already exists but could not be retrieved: ${authError.message}`,
            });
          }
        } else {
          console.error("Auth creation error:", authError);
          return res.status(400).json({
            error: `Failed to create user: ${authError.message}`,
          });
        }
      } else {
        userId = authData.user.id;
        isNewUser = true;
      }
    }

    const userCode = generateUserCode(name);

    // Step 2: Upsert profile (using service role, bypasses RLS)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          name,
          email,
          balance: Number(amount),
          account_status: "active",
          user_code: userCode,
          weekly_roi_percentage: Number(roi_percentage),
          roi_percentage: Number(roi_percentage),
        },
        { onConflict: "id" }
      )
      .select();

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      return res.status(400).json({
        error: `Failed to create profile: ${profileError.message}`,
      });
    }

    // Step 3: Create investment record (using service role, bypasses RLS)
    const { data: investment, error: investmentError } = await supabaseAdmin
      .from("investments")
      .insert({
        user_id: userId,
        amount: Number(amount),
        roi: Number(roi_percentage),
        plan_id: plan_id || null,
        start_date,
        status: "active",
        type: "admin-created",
        duration: 7,
      })
      .select()
      .single();

    if (investmentError) {
      console.error("Investment creation error:", investmentError);
      return res.status(400).json({
        error: `Failed to create investment: ${investmentError.message}`,
      });
    }

    // Success response
    res.status(200).json({
      ok: true,
      message: "Investor created successfully",
      data: {
        user: {
          id: userId,
          email,
          name,
          user_code: userCode,
        },
        investment,
      },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({
      error: err.message || "Internal server error",
    });
  }
}
