# GetBizIdea — kontext pro Claude

Tento soubor čte Claude Code i Claude v claude.ai projektu "GET BIZ IDEA". Obě strany na něm staví, takže ho po každé větší změně aktualizuj (hlavně sekci **Aktuální stav**).

Vlastník: Jan (Honza). Komunikuje česky, stručně, čísla napřed. Web i všechny texty pro zákazníky jsou anglicky.

## Co to je
Kvízový funnel na https://getbizidea.com:
1. `quiz.html` — 10 otázek → `POST /api/generate` (Claude Haiku) → uloží řádek do Supabase `results`.
2. E-mail gate (`/api/save-email`, naplánuje 2 připomínky přes Brevo) → free preview výsledku.
3. Platba přes Stripe Checkout (`/api/checkout`) → `POST /api/webhook` nastaví `results.paid = true` a pošle magic link.
4. Po zaplacení `quiz.html?unlocked=true&rid=…` → `/api/result` vrátí plný plán, `/api/generate-block` dogeneruje prémiové bloky 1–5 (cachuje se do `results.plan.blocks`).

## Produkty a ceny (zdroj pravdy: `api/checkout.js`)
| product | cena | co | webhook větev |
|---|---|---|---|
| (default) | €17 | hlavní 90denní plán | `paid=true`, welcome e-mail + 7 drip e-mailů |
| `upsell` | €27 | Launch Week / 30denní coach | `plan.upsell_paid=true`, vygeneruje 30 dní a naplánuje 30 e-mailů |
| `plan` | €17 | hotový plán z `plans.html` (10 plánů v `api/_plan-content.js`) | pošle plán e-mailem |
| `tripwire` | €7 | 30denní akční plán — **v UI vypnuto** | jako hlavní, bez dripu |

Když měníš cenu, změň ji na všech místech: `api/checkout.js`, `api/admin.js` (výpočet tržeb), `public/index.html` (texty + schema.org `offers`), `public/quiz.html` (FB Pixel `Purchase` value), `api/save-email.js` (připomínka).

## Stack
- **Hosting:** Vercel. Statické soubory jsou v `public/` (`cleanUrls`), funkce v `api/*.js` (ESM, max 60 s). Cron `/api/keep-alive` drží Supabase free tier vzhůru.
- **Data:** Supabase, tabulka `results` (`id`, `quiz_data`, `plan` jsonb, `email`, `paid`, `is_test`, `language`, `created_at`). `supabase/schema.sql` obsahuje jen `user_plans` a `checklist_tasks` (dashboard/login); schéma `results` v repu chybí.
- **AI:** `@anthropic-ai/sdk`, model `claude-haiku-4-5-20251001`.
- **E-maily:** Brevo (`api/_send-email.js`, plánování přes `scheduledAt`).
- **Analytika:** PostHog (`ph()`) a Meta Pixel (`fbqt()`) v `quiz.html`.

Soubory s podtržítkem (`api/_*.js`) jsou sdílené moduly, ne endpointy.

## Env proměnné (Vercel)
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `BREVO_API_KEY`, `ADMIN_SECRET` (admin dashboard i testovací odemčení), `NEXT_PUBLIC_URL`.

## Pravidla
- Neposílej nic na `main` bez souhlasu Honzy. Pracuj ve větvi a Vercel preview použij k ověření.
- Cena a odemčení se rozhodují **jen na serveru**. Nikdy nevěř ceně, `paid` ani `testMode`, které přijdou z klienta.
- Čísla sociálního důkazu (počty, hodnocení) musí být reálná. Veřejné počty dodává `/api/stats`. Vymyšlená čísla a hodnocení jsou v EU riziko podle směrnice o nekalých obchodních praktikách a porušují zásady Googlu pro structured data.
- `public/index.backup*.html` a `api/send-email.js` jsou vyloučené z deploye (`.vercelignore`).
- `node_modules/` se necommituje, Vercel instaluje z `package-lock.json`.

## Aktuální stav
Strategie a priority jsou v claude.ai projektu v dokumentu `claude/monetizace-launch-plan.md`. Poslední audit je v `claude/audit-2026-09-25.md`.

Otevřené úkoly (seřazené podle priority):
1. **Paywall leak:** `/api/generate` vrací celý `full_plan` do prohlížeče ještě před zaplacením. Kdo otevře DevTools, má plán zdarma. Je potřeba vracet jen preview a `full_plan` servírovat až přes `/api/result` po zaplacení. Vyžaduje úpravu `renderResult()` v `quiz.html`.
2. **Supabase RLS:** serverové funkce používají anon klíč, který je zároveň veřejně v `public/js/config.js`. Pokud RLS na `results` povoluje anon `update`, kdokoli si může přes REST nastavit `paid=true`, a pokud povoluje `select`, vidí e-maily všech zákazníků. Řešení: serverové funkce přepnout na `SUPABASE_SERVICE_ROLE_KEY` a pro anon na `results` RLS zavřít.
3. **Upsell (€27):** generování 30denního coache běží až po odeslání odpovědi webhooku a Vercel ho může uříznout. Ověřit na reálné objednávce, ideálně přesunout do `waitUntil` nebo do samostatného jobu.
4. **Refundy:** webhook neřeší `charge.refunded`, takže vrácená platba nechá přístup odemčený.
5. **Nefunkční odhlášení z e-mailů:** e-maily naplánované v Brevo jdou odeslat i po unsubscribe, protože `api/unsubscribe.js` jen nastaví příznak. Coach e-maily navíc volají `?email=` a to endpoint nezpracuje.
6. **Chybějící endpoint:** `quiz.html` volá `/api/generate-premium`, který neexistuje.
7. **Klamavé texty:** testimonials používají stock avatary (pravatar.cc) a připomínka po 72 h tvrdí "your plan expires soon", i když plány neexpirují. Obojí je potřeba nahradit reálnými recenzemi a pravdivým textem.
8. **`landing.html`:** stará verze (€7, odkazy na `app.getbizidea.com`). Buď smazat, nebo přesměrovat na `/`.
