# AI Integration Hub

An "AI Integration & Agent Control Platform" — lets AI agents safely call external commerce
systems through a normalized set of canonical tools (`orders.get`, `orders.search`,
`orders.refund`), gated by a Policy Engine, a human-approval flow, and an immutable audit log.

## Architecture

This repo is the **frontend only** — a React + Vite + Tailwind single-page app. It talks to a
Supabase backend over `@supabase/supabase-js` (auth) and a hand-rolled JSON-RPC 2.0 MCP gateway
(`src/lib/mcp.ts` → `${VITE_SUPABASE_URL}/functions/v1/hub-mcp-server`).

The backend (Postgres schema, GoTrue auth, and the `hub-mcp-server` edge function — MCP gateway,
Policy Engine, connectors, tool handlers) does **not** live in this repo. It is currently deployed
as part of the `yogaipilot` repo's shared Supabase instance; see `supabase/README.md` and
`docs/access-and-accounts.md` (gitignored, contains live credentials) for the full writeup and
current status of that arrangement. That backend is being migrated to its own dedicated Supabase
project (same Supabase account/org, separate database) rather than continuing to share
`yogaipilot`'s — track that migration in the `yogaipilot` repo, not here.

## Stack

React 18 + React Router 7 + Vite 5 + Tailwind 3, TypeScript, Vitest for tests. No backend code or
edge functions in this repo — see Architecture above.

## What's implemented

- **Auth & onboarding** (`src/pages/SignIn.tsx`, `src/pages/Onboarding.tsx`): Supabase email/password
  sign-in, password reset, and first-run Organization → Project creation.
- **Console** (`src/App.tsx`, `src/components/AppShell.tsx`): 8 authenticated sections —
  Dashboard, Integrations (connect WooCommerce/Shopware/Magento/Shopify stores), Agents (create
  agents, grant per-tool policy: allow/deny/require-approval), Approvals (pending queue, approve
  runs the real action), Audit (immutable log, CSV export), API Keys, Team (invite via
  link-copy), Account (GDPR-style data export/delete).
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

1. **Backend has no dedicated production Supabase project yet** — see Architecture above.
2. **Resend has no verified sending domain** — password-reset/invite emails to real users fail;
   only the account owner currently receives mail (see `docs/access-and-accounts.md`).
3. **Shopify connector** is only smoke-tested against a placeholder store; needs a real
   Partner/dev-store credential set before it can leave "coming soon" status.
4. No shared UI component library yet (`src/components/ui/` is a placeholder directory) — pages
   currently hand-roll Tailwind classes directly.
