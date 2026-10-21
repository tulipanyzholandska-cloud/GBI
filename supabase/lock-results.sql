-- GetBizIdea — lock down public.results (plans, emails, paid flag)
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
--
-- RUN ONLY AFTER SUPABASE_SERVICE_ROLE_KEY is set in Vercel (project-7ug16) and
-- a redeploy is live. The API (api/_supabase.js) then uses the service-role key,
-- which bypasses RLS. Running this earlier breaks the site.
--
-- No policies are created on purpose: the browser never queries `results`
-- directly, so the public anon key gets no access at all.

alter table public.results enable row level security;

-- Belt and braces: strip table privileges from the public roles too.
revoke all on table public.results from anon, authenticated;

-- Rollback (if something breaks):
--   alter table public.results disable row level security;
--   grant all on table public.results to anon, authenticated;
