/**
 * Admin Auth Check — shared helper for all sensitive admin API endpoints.
 *
 * Reads the Authorization: Bearer <jwt> header, verifies the JWT with Supabase,
 * then confirms the user has an admin role in the user_roles table.
 *
 * Returns: { adminUserId, error }
 * If error is non-null, the caller should respond with 401/403 immediately.
 *
 * Usage in any handler:
 *   const { adminUserId, error: authErr } = await verifyAdmin(req, supabaseAdmin);
 *   if (authErr) return res.status(authErr.status).json({ error: authErr.message });
 */

import { createClient } from "@supabase/supabase-js";

/**
 * @param {import("http").IncomingMessage} req
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @returns {Promise<{ adminUserId: string|null, error: { status: number, message: string }|null }>}
 */
export async function verifyAdmin(req, supabaseAdmin) {
  // 1. Extract JWT from Authorization header
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      adminUserId: null,
      error: { status: 401, message: "Missing or invalid Authorization header" }
    };
  }

  const jwt = authHeader.slice(7).trim();
  if (!jwt) {
    return {
      adminUserId: null,
      error: { status: 401, message: "Empty JWT token" }
    };
  }

  // 2. Verify JWT with Supabase (using anon-key client to validate the token)
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || // Vite projects use this name
    "";

  if (!anonKey) {
    return { adminUserId: null, error: { status: 500, message: "Server misconfiguration: missing Supabase anon key" } };
  }

  const supabaseAnon = createClient(process.env.SUPABASE_URL, anonKey);

  const { data: { user }, error: jwtError } = await supabaseAnon.auth.getUser(jwt);
  if (jwtError || !user) {
    return {
      adminUserId: null,
      error: { status: 401, message: "Invalid or expired token" }
    };
  }

  // 3. Check user_roles table for admin role
  const { data: roleRow, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .single();

  if (roleError || !roleRow) {
    return {
      adminUserId: null,
      error: { status: 403, message: "Access denied: admin role required" }
    };
  }

  return { adminUserId: user.id, error: null };
}

/**
 * @param {import("http").IncomingMessage} req
 * @returns {Promise<{ user: import("@supabase/supabase-js").User|null, error: { status: number, message: string }|null }>}
 */
export async function verifyUser(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      user: null,
      error: { status: 401, message: "Missing or invalid Authorization header" }
    };
  }

  const jwt = authHeader.slice(7).trim();
  if (!jwt) {
    return {
      user: null,
      error: { status: 401, message: "Empty JWT token" }
    };
  }

  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "";

  if (!anonKey || !process.env.SUPABASE_URL) {
    return { user: null, error: { status: 500, message: "Server misconfiguration: missing Supabase credentials" } };
  }

  const supabaseAnon = createClient(process.env.SUPABASE_URL, anonKey);
  const { data: { user }, error: jwtError } = await supabaseAnon.auth.getUser(jwt);

  if (jwtError || !user) {
    return {
      user: null,
      error: { status: 401, message: "Invalid or expired token" }
    };
  }

  return { user, error: null };
}

