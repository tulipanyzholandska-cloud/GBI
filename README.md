# GetBizIdea

AI business-idea quiz → personalized 90-day launch plan (€17 one-time). Live: https://getbizidea.com

- `public/` — static site (Vercel `cleanUrls`)
- `api/` — Vercel serverless functions (Stripe, Supabase, Anthropic, Brevo)
- `supabase/` — SQL schema

Architecture, products, env vars and open issues: see [CLAUDE.md](CLAUDE.md).

## Local
```sh
npm install
npx vercel dev   # needs env vars from Vercel project
```
