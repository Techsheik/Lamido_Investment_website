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
    const { userId: inputUserId, name, email, amount: inputAmount, units: inputUnits, plan_id, start_date, status: inputStatus } = req.body;

    let userId = inputUserId;
    let targetEmail = email;
    let targetName = name;

    // Validate start date
    const startDate = start_date || new Date().toISOString();
    const status = inputStatus || "active";

    // Determine units and amount ($70 per share unit)
    const UNIT_PRICE = 70;
    let units = Number(inputUnits);
    if (!units || isNaN(units) || units < 1) {
      units = Math.max(1, Math.round(Number(inputAmount || 70) / UNIT_PRICE));
    }
    const investAmount = units * UNIT_PRICE;

    // Step 1: Resolve user ID (existing profile or create new)
    if (userId) {
      const { data: existingProfile, error: getProfErr } = await supabaseAdmin
        .from("profiles")
        .select("id, name, email, user_code")
        .eq("id", userId)
        .single();
      
      if (getProfErr || !existingProfile) {
        return res.status(404).json({ error: "Selected user profile not found" });
      }
      targetEmail = existingProfile.email;
      targetName = existingProfile.name;
    } else if (email) {
      // Check if profile already exists with this email
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, name, email")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        userId = existingProfile.id;
        targetName = targetName || existingProfile.name;
      } else {
        // Try to create auth user using admin API
        const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          user_metadata: { name: targetName || email.split("@")[0] },
          email_confirm: true,
        });

        if (authError) {
          const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
          const authUser = usersData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
          if (authUser) {
            userId = authUser.id;
          } else {
            return res.status(400).json({ error: `Failed to create user auth: ${authError.message}` });
          }
        } else {
          userId = authData.user.id;
        }

        const userCode = generateUserCode(targetName || "User");
        await supabaseAdmin.from("profiles").upsert({
          id: userId,
          name: targetName || email.split("@")[0],
          email,
          balance: 0,
          account_status: "active",
          user_code: userCode,
        });
      }
    } else {
      return res.status(400).json({ error: "Please select an existing user or provide user email" });
    }

    // Step 2: Auto-detect open entry window / active cycle to attach
    const { data: openEntry } = await supabaseAdmin
      .from("entry_windows")
      .select("id, cycle_number")
      .eq("status", "ENTRY_OPEN")
      .maybeSingle();

    const entryId = openEntry?.id || null;

    // Create investment record (using service role)
    const { data: investment, error: investmentError } = await supabaseAdmin
      .from("investments")
      .insert({
        user_id: userId,
        amount: investAmount,
        units: units,
        roi: 0,
        plan_id: plan_id || null,
        entry_id: entryId,
        start_date: startDate,
        end_date: new Date(new Date(startDate).getTime() + (7 * 24 * 60 * 60 * 1000)).toISOString(),
        status: status,
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
      message: "Investment created successfully",
      data: {
        user: {
          id: userId,
          email: targetEmail,
          name: targetName,
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
