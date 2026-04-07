const { createClient } = require("@supabase/supabase-js");

/**
 * Admin client (service role). Returns null if not configured.
 * Prefer SUPABASE_URL; fall back to VITE_SUPABASE_URL for local dev convenience.
 */
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

module.exports = { getSupabaseAdmin };
