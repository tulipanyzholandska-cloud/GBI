-- GetBizIdea: close the `results` table to the public anon key.
--
-- The anon key ships to every browser in public/js/config.js. While `results` is open
-- to it, anyone can read customer emails and plans, and can set paid = true.
--
-- ORDER MATTERS. Run this only after SUPABASE_SERVICE_ROLE_KEY is set on the live Vercel
-- project and redeployed, and https://getbizidea.com/api/keep-alive reports
-- "db_key":"service". Otherwise the site loses database access.
--
-- Undo: grant select, insert, update on public.results to anon; and recreate your policy.

alter table public.results enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'results' loop
    execute format('drop policy %I on public.results', p.policyname);
  end loop;
end $$;

revoke all on public.results from anon, authenticated;
