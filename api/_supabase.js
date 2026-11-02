import { createClient } from '@supabase/supabase-js';

// Server-side client. Uses the service role key so `results` can be closed to the
// public anon key (see supabase/lock-results.sql). Falls back to the anon key until
// SUPABASE_SERVICE_ROLE_KEY is set in Vercel.
export function db() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );
}
