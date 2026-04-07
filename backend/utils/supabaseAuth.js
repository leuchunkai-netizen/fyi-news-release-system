const { createClient } = require("@supabase/supabase-js");

/**
 * Resolve Supabase user from Authorization: Bearer <access_token>.
 * Uses anon key (JWT verification); does not use service role.
 */
async function getUserFromBearer(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.warn("[supabaseAuth] Missing SUPABASE_URL or SUPABASE_ANON_KEY for JWT verification.");
    return null;
  }

  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await sb.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

module.exports = { getUserFromBearer };
