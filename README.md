# AI Integration Hub

An "AI Integration & Agent Control Platform" — lets AI agents safely call external business
systems through a normalized set of canonical tools (`orders.refund`, `invoices.search`,
`transactions.search`, ...), gated by a Policy Engine, a human-approval flow, and an immutable
audit log. Started as a commerce-only integration point (WooCommerce/Shopware/Shopify/Magento);
now spans bookkeeping (Lexoffice), CMS (WordPress), time tracking (Toggl Track), and read-only
banking (GoCardless Bank Account Data) too, via the same connector-factory pattern.

## Architecture

This repo is a self-contained project — **frontend + backend both live here**, with their own
independent, self-hosted Supabase stack (Postgres, GoTrue auth, edge functions), deployed via
`deploy.sh` to its own containers/ports (currently on the same VPS as other projects, but fully
separate — no shared database, no shared tables). This is a deliberate change from an earlier
design where the backend lived in a different repo's shared Supabase project; there is no runtime
dependency on any other repo anymore.

- **Frontend**: React + Vite + Tailwind single-page app. Talks to the backend over
  `@supabase/supabase-js` (auth) and a hand-rolled JSON-RPC 2.0 MCP gateway (`src/lib/mcp.ts` →
  `${VITE_SUPABASE_URL}/functions/v1/hub-mcp-server`).
- **Backend** (`supabase/functions/hub-mcp-server/`): the MCP gateway — JSON-RPC 2.0 dispatch,
  Policy Engine (`lib/policy.ts`), AES-256-GCM credential encryption at rest (`lib/crypto.ts`),
  and a connector-factory pattern (`lib/connectors/`) — one connector class per platform, each
  implementing `testConnection()`/`getCapabilities()`/`execute(tool, input)`. Adding a platform is
  one connector file + one `tools/<domain>.ts` module + one migration row, no changes to auth,
  policy, or audit logic (all domain-agnostic).
- Also self-contained in this repo: **Stripe subscription billing**
  (`supabase/functions/hub-billing*`, `supabase/migrations/20260824100000_hub_billing.sql`).

See `supabase/README.md` for deploy steps and `docs/access-and-accounts.md` (gitignored, contains
live credentials) for environment access.

## Stack

React 18 + React Router 7 + Vite 5 + Tailwind 3, TypeScript, Vitest for tests on the frontend;
Deno edge functions (Supabase) on the backend.

## Calling the Hub as an agent developer

`sdk/` is `@ai-integration/hub`, the official JS/TS client for the `hub-mcp-server` MCP gateway —
authenticate with a project API key, then `client.tools.orders.refund({...})` /
`client.tools.cms.pages.search({...})` / any other canonical tool by dot-path. Not yet published
to the public npm registry; install it with `npm install github:toasternet-gmbh/hub-sdk` (a
single-package mirror repo, kept in sync on release — see `sdk/README.md`). Full usage docs,
including how to handle a `require_approval` response, are in that package's own README. This is
what the Integrations → API Keys page's Quick Start panel and the Help Center's "API keys and the
Node.js client" article point to.

## What's implemented

- **Auth & onboarding** (`src/pages/SignIn.tsx`, `src/pages/Onboarding.tsx`): Supabase email/password
  sign-in, password reset, and first-run Organization → Project creation.
- **Console** (`src/App.tsx`, `src/components/AppShell.tsx`): 8 authenticated sections —
  Dashboard, Integrations (connect commerce, bookkeeping, CMS, time-tracking, and banking
  platforms — WooCommerce, Shopware, Shopify, Magento, Lexoffice, WordPress, Toggl Track,
  GoCardless), Agents (create agents, grant per-tool policy: allow/deny/require-approval),
  Approvals (pending queue, approve runs the real action), Audit (immutable log, CSV export), API
  Keys, Billing (Stripe Checkout subscription + Customer Portal), Team (invite via link-copy),
  Account (GDPR-style data export/delete).
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

1. **`hub-billing`/`hub-billing-webhook` are built but not fully wired up** — need
   `supabase db push` + `supabase functions deploy` against this project's own Supabase stack,
   plus registering the Stripe webhook endpoint to mint a real `STRIPE_WEBHOOK_SECRET_SANDBOX` —
   see `supabase/README.md`. Currently only test-mode Stripe keys are wired up (product/price
   already created: `price_1U7sLULRDPdaPpE2DvlT0yrl`, €49/month).
2. **Resend has no verified sending domain** — password-reset/invite emails to real users fail;
   only the account owner currently receives mail (see `docs/access-and-accounts.md`). The
   intended sending address is `info@innov-ai-tive.de`, once that domain is verified in Resend.
3. **Shopify connector** is only smoke-tested against a placeholder store; needs a real
   Partner/dev-store credential set before it can leave "coming soon" status.
4. **Lexoffice, WordPress, Toggl Track, and GoCardless connectors** have each been verified to
   reach the real provider API (they surface genuine provider error responses on bad/dummy
   credentials), but none has been exercised end-to-end against a real, fully-authorized account
   yet — do that before flipping `enabled=true` on those platforms for real customers.
5. No shared UI component library yet (`src/components/ui/` is a placeholder directory) — pages
   currently hand-roll Tailwind classes directly.
