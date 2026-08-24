# AI Integration Hub

An "AI Integration & Agent Control Platform" — lets AI agents safely call external commerce
systems through a normalized set of canonical tools (`orders.get`, `orders.search`,
`orders.refund`), gated by a Policy Engine, a human-approval flow, and an immutable audit log.

## Architecture

This repo is the **frontend only** — a React + Vite + Tailwind single-page app. It talks to a
Supabase backend over `@supabase/supabase-js` (auth) and a hand-rolled JSON-RPC 2.0 MCP gateway
(`src/lib/mcp.ts` → `${VITE_SUPABASE_URL}/functions/v1/hub-mcp-server`).

Most of the backend (Postgres schema, GoTrue auth, and the `hub-mcp-server` edge function — MCP
gateway, Policy Engine, connectors, tool handlers) does **not** live in this repo — it's deployed
as part of the `yogaipilot` repo's shared Supabase project (`oipaakxcjmwfhvpzhwcu`); see
`supabase/README.md` and `docs/access-and-accounts.md` (gitignored, contains live credentials).
Every table the Hub owns there is prefixed `hub_` to avoid colliding with yogaipilot's own
unrelated tables of the same short names — there is no dedicated Supabase project for the Hub, by
deliberate decision (no separate project quota available).

The one exception: **Stripe subscription billing** (`supabase/functions/hub-billing*`,
`supabase/migrations/20260824100000_hub_billing.sql`) lives in this repo and is self-contained (no
imports from yogaipilot's code), still deployed to the same shared project — see
`supabase/README.md` for the deploy steps.

## Stack

React 18 + React Router 7 + Vite 5 + Tailwind 3, TypeScript, Vitest for tests. Frontend-only, plus
the self-contained `hub-billing*` Stripe edge functions — see Architecture above.

## What's implemented

- **Auth & onboarding** (`src/pages/SignIn.tsx`, `src/pages/Onboarding.tsx`): Supabase email/password
  sign-in, password reset, and first-run Organization → Project creation.
- **Console** (`src/App.tsx`, `src/components/AppShell.tsx`): 8 authenticated sections —
  Dashboard, Integrations (connect WooCommerce/Shopware/Magento/Shopify stores), Agents (create
  agents, grant per-tool policy: allow/deny/require-approval), Approvals (pending queue, approve
  runs the real action), Audit (immutable log, CSV export), API Keys, Billing (Stripe Checkout
  subscription + Customer Portal), Team (invite via link-copy), Account (GDPR-style data
  export/delete).
- **Marketing/legal pages**: Landing (with in-page Features/Platforms anchors), Help Center with
  static EN/DE articles (`src/lib/helpArticles.ts`), Imprint, Privacy, Terms.
- **i18n**: hand-rolled EN/DE dictionary (`src/lib/i18n.tsx`), covering every page's copy.
- Route-level code-splitting (`React.lazy` per page) and vendor chunk splitting
  (`vite.config.ts`) to keep the initial JS payload small.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                  # http://localhost:3060
npm run typecheck
npm run test
npm run build
```

## Known gaps before a real go-live

1. **`hub-billing`/`hub-billing-webhook` are built but not deployed yet** — need Supabase CLI
   access to the shared project (`supabase login` as an account with access to
   `oipaakxcjmwfhvpzhwcu`), then `supabase db push` + `supabase functions deploy` + registering
   the Stripe webhook endpoint to mint a real `STRIPE_WEBHOOK_SECRET_SANDBOX` — see
   `supabase/README.md`. Currently only test-mode Stripe keys are wired up
   (product/price already created: `price_1U7sLULRDPdaPpE2DvlT0yrl`, €49/month).
2. **Resend has no verified sending domain** — password-reset/invite emails to real users fail;
   only the account owner currently receives mail (see `docs/access-and-accounts.md`). The
   intended sending address is `info@innov-ai-tive.de`, once that domain is verified in Resend.
3. **Shopify connector** is only smoke-tested against a placeholder store; needs a real
   Partner/dev-store credential set before it can leave "coming soon" status.
4. No shared UI component library yet (`src/components/ui/` is a placeholder directory) — pages
   currently hand-roll Tailwind classes directly.
