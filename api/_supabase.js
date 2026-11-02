import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client. Uses the service-role key so the `results` table
// can be locked down with RLS (no anon access). Falls back to the anon key until
// SUPABASE_SERVICE_ROLE_KEY is set in Vercel.
export function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );
}
