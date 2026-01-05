/**
 * Admin Investor Creation Endpoint
 * 
 * This is a secure server-side endpoint that uses the Supabase service role key
 * to create auth users and investment records without RLS restrictions.
 * 
 * DO NOT expose SUPABASE_SERVICE_ROLE_KEY in the frontend!
 * This key should only exist in server environment variables.
 * 
 * Usage:
 * - Deploy this as a serverless function (Vercel, Netlify, AWS Lambda, etc.)
 *   or as a Node.js endpoint in your Express/Fastify server.
 * - Set environment variables:
 *   SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
 * - Call from frontend: POST /api/admin/create-investor with JSON body
 */

import { createClient } from "@supabase/supabase-js";

// Initialize Supabase admin client (service role key bypasses RLS)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    const { name, email, amount, roi_percentage, plan_id, start_date } = req.body;

    // Validate inputs
    if (!name || !email || !amount || roi_percentage === undefined || !start_date) {
      return res.status(400).json({
        error: "Missing required fields: name, email, amount, roi_percentage, start_date",
      });
    }

    // Step 1: Create auth user using admin API (bypasses email confirmation)
    const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      user_metadata: { name },
      email_confirm: true, // Auto-confirm email so user can log in immediately
    });

    if (authError) {
      console.error("Auth creation error:", authError);
      return res.status(400).json({
        error: `Failed to create user: ${authError.message}`,
      });
    }

    const userId = authData.user.id;
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

/**
 * Example usage from frontend:
 * 
 * async function createAdminInvestor(formData) {
 *   const response = await fetch('/api/admin/create-investor', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       name: formData.name,
 *       email: formData.email,
 *       amount: formData.amount,
 *       roi_percentage: formData.roi_percentage,
 *       plan_id: formData.plan_id,
 *       start_date: formData.start_date,
 *     })
 *   });
 *   
 *   if (!response.ok) {
 *     const err = await response.json();
 *     throw new Error(err.error);
 *   }
 *   
 *   return await response.json();
 * }
 */
