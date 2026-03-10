import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env for real backend."
  );
} else {
  // Helpful during setup: verify we are pointing at the right Supabase project.
  console.log("Supabase client configured with URL:", supabaseUrl);
}

/** Browser client for Supabase (Auth + Database). Use for all frontend calls. */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
