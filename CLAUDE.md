# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"AI Integration Hub" — lets AI agents safely call external business systems (e-commerce,
bookkeeping, CMS, time tracking, banking) through a normalized set of canonical tools
(`orders.refund`, `invoices.search`, `cms.pages.search`, ...), gated by a Policy Engine, a
human-approval flow, and an immutable audit log. Frontend and backend both live in this repo, each
deployed independently — there is no runtime dependency on any other repo.

## Repo layout

- `src/` — React frontend (the console app + marketing/legal pages).
- `supabase/functions/hub-mcp-server/` — the MCP gateway itself (Deno edge function): JSON-RPC
  dispatch, Policy Engine, connectors, tool handlers. This is the real backend logic.
- `supabase/functions/hub-billing*` — separate, self-contained Stripe billing edge functions.
- `supabase/migrations/` — one SQL file per schema change, filename-timestamped and applied in
  order; `supabase/migrations_archive/` is old history kept for reference, not applied anywhere.
- `sdk/` — `@ai-integration/hub`, the published JS/TS client for third-party agent developers.
  Developed here, but mirrored on release to its own repo, `toasternet-gmbh/hub-sdk` (that's what
  `npm install github:toasternet-gmbh/hub-sdk` actually installs — plain npm can't install a
  subdirectory of a git repo, so the standalone mirror exists specifically to make that work).
- `deploy.sh` — the one script that stands up/updates the self-hosted Supabase stack (Postgres,
  GoTrue, Kong, edge functions) this project runs on, and optionally the frontend container.

## Commands

Frontend (run from repo root):
```bash
npm install
npm run dev          # http://localhost:3060
npm run typecheck    # tsc --noEmit
npm run test         # vitest run, all *.test.ts under src/lib/__tests__/
npm run test -- path/to/file.test.ts   # single file
npm run build
```

SDK (run from `sdk/`):
```bash
npm install           # also runs `prepare` → builds dist/
npm run typecheck
npm run test
npm run build
```

Backend (`supabase/functions/hub-mcp-server/`) is Deno — there is no local `tsc`/lint step for it
and no unit test suite. It's verified by deploying and calling the real edge function (see
"Verifying backend changes" below).

## Backend architecture (`hub-mcp-server`)

One Deno edge function speaking plain JSON-RPC 2.0 over HTTP POST (no `@modelcontextprotocol/sdk`
dependency) — see `index.ts`. Per `tools/call` request:

1. **Auth** (`lib/mcpAuth.ts`) — either a project-scoped API key (`hub_...`, hashed and looked up
   in `hub_api_keys`) or a Supabase user JWT + an explicit `project_id` in the JSON-RPC params
   (users can belong to multiple projects, so the JWT alone doesn't say which one). **`project_id`
   goes inside `params.arguments`, not as a sibling of `params`** — the frontend's `mcp()` helper
   (`src/lib/mcp.ts`) does this merge automatically; a raw JSON-RPC call has to do it by hand.
2. **Gating** (`toolRegistry.ts`'s `isGatedTool`) — a tool whose name starts with one of
   `GATED_DOMAIN_PREFIXES` (`orders.`, `invoices.`, `cms.`, ...) is a canonical domain tool acting
   on a connected external system. It requires an `X-Agent-Id` header and goes through the Policy
   Engine. Everything else (`create_integration`, `create_agent`, `list_approvals`, ...) is a plain
   project-member operation — no agent, no policy check.
3. **Policy resolution** (`lib/policy.ts`'s `resolvePermission`) — most-specific-wins:
   `hub_tool_registry.enabled = false` is a hard Hub-wide off switch checked first (can't be
   overridden per agent) → `(agent, tool, this exact integration)` row in
   `hub_agent_tool_permissions` → `(agent, tool, all integrations)` row → the tool's own
   `default_policy`. Result is `allow` (runs immediately), `deny` (throws), or `require_approval`
   (parks the call in `hub_action_approvals`, emails project owners, returns
   `{approval_required: true, approval_id}` instead of running it — the agent must not treat that
   as an error or a real result). Every gated call is audit-logged to `hub_audit_logs` regardless
   of outcome.
4. **Execution** — the handler loads the integration's connector (`lib/connectors/factory.ts`)
   and calls `connector.execute(tool, input)`.

### Connector pattern

`lib/connectors/types.ts` defines the whole contract: `testConnection()`, `getCapabilities()`,
`execute(tool, input)`. `factory.ts` is a single switch on `platform` that decrypts the
integration's stored credentials (`lib/crypto.ts` — AES-256-GCM, key from
`CREDENTIALS_ENCRYPTION_KEY`) and constructs the right connector class. **Adding a platform to an
existing category needs no changes to auth, policy, gating, or audit logic** — just:

1. A new `lib/connectors/<platform>.ts` implementing the `Connector` interface.
2. A `case` for it in `factory.ts`.
3. Its credential shape added to `tools/integrations.ts`'s `platform` enum + description.
4. A migration: an `hub_platform_types` row (`category`, `auth_type`: `'api_key'` for any
   credentials-form flow including OAuth2 client-credentials, `'oauth2'` only for a true
   consent-redirect flow like GoCardless's) plus appending the platform id to the relevant
   existing `hub_tool_registry.supported_platforms` arrays. Ship `enabled: false` until tested.
5. A matching entry in `src/lib/platformCatalog.ts` (id, category, name, icon, color,
   EN/DE description) — the single source shared by the Landing page, the Blueprint page, and the
   Integrations connect picker in the frontend, so those three never drift out of sync with each
   other.

A *new domain* (not just a new platform in an existing category) additionally needs a
`tools/<domain>.ts` module (definitions + handlers, same shape as `tools/orders.ts`) registered in
`toolRegistry.ts`'s `MODULES`, and its prefix added to `GATED_DOMAIN_PREFIXES` if it should be
policy-gated.

### Verifying backend changes

There's no local Deno typecheck/test run. The established pattern for a new/changed connector is:
deploy to the local dev stack, then **call it for real** — create an integration with an
intentionally-wrong credential and confirm the error that comes back is the actual provider's
error (e.g. a real HTTP 401 from the real API host), not a mock. That single round-trip proves the
base URL, auth header shape, and endpoint path are all correct — a green unit test against a
stubbed fetch would not catch a wrong hostname the way a real 401 does.

## Frontend architecture

- **Routing** (`src/App.tsx`): `/:lang/*` (`en`/`de`) wraps everything; `LocalizedApp` renders
  public routes plus `app/*` → `AuthedArea` (the signed-in console, gated on a Supabase session)
  and `superadmin/*` → `SuperAdminGate` (gated additionally on platform-admin status). Old
  unprefixed URLs (`/help`, `/app/*`, ...) redirect to their `/:lang/...` equivalent for
  bookmarks/links from before language-prefixed routing existed.
- **i18n** (`src/lib/i18n.tsx`): a hand-rolled flat `STRINGS` dictionary (`"page.key": {en, de}`),
  `useI18n()` exposes `t(key)` and `path(p)` (prefixes the current `/:lang`). No external i18n
  library.
- **MCP client** (`src/lib/mcp.ts`): the `mcp<T>(name, args, opts)` helper wraps the same
  JSON-RPC 2.0 call the backend speaks, authenticated with the signed-in user's Supabase session
  (browser-only — not what third-party agent developers use; that's `sdk/`).
- **Onboarding/project selection**: `AuthedArea` caches the selected org/project in
  `localStorage`, keyed per user id (`storageKey()`) so a second account signing in on the same
  browser doesn't inherit the previous account's selection.
- `src/components/ui/`, `src/contexts/`, `src/integrations/` exist but are currently empty
  placeholders, not in active use.

## Deployment

This project runs its own independent, self-hosted Supabase stack (not shared with any other
project) via `deploy.sh --supabase-only` (Postgres/GoTrue/Kong/edge-functions only, no web
container — the frontend runs via `npm run dev` on the host during development). Local dev stack
lives under `--base-dir=/Users/anhduong/.yogaipilot-deploy` (deploy.sh is a generic multi-project
deploy script shared with other projects on the same machine/VPS).

**Use an absolute path for `--base-dir`, not `~/...`** — piped through `eval`, the tilde does not
expand, and the script will silently clone a fresh copy of the entire upstream `supabase/supabase`
repo into a literal `./~/...` directory inside the project instead of using the existing local
stack.

Required env (`.env.supabase`, gitignored — see `.env.example` for the template):
`CREDENTIALS_ENCRYPTION_KEY` (32 raw bytes, base64 — connector credential encryption) is required;
`GOCARDLESS_SECRET_ID`/`GOCARDLESS_SECRET_KEY` are optional, needed only to enable the
`gocardless` banking platform.

## Known gaps

- `hub-billing`/`hub-billing-webhook` are built but not fully wired up against this project's own
  Supabase stack yet (test-mode Stripe keys only).
- Resend has no verified sending domain — auth emails only reach the account owner.
- Most connectors (Shopify, Lexoffice, WordPress, Toggl, GoCardless, sevDesk, Personio,
  Contentful, Clockify, HubSpot, PrestaShop) have been verified to reach their real provider API
  but not exercised end-to-end against a real, fully-authorized account — confirm that before
  enabling a platform for real customers. PrestaShop is further along than the rest of this group:
  it was round-tripped against a real, live local PrestaShop 8 store (Docker,
  `prestashop/prestashop:8-apache`, with the Webservice API genuinely enabled and a real
  webservice key), and `orders.search`/`orders.get`/`products.search`/`products.get` all returned
  real demo order/product data through the Hub — but that's still Docker demo data, not a real
  customer's own store, so it's not yet at the "real customer account" bar the others in this
  group need.
- DATEV, JTL, and TYPO3 connectors are unverified and ship `enabled: false`: DATEV requires DATEV
  Marktplatz partner certification (no public sandbox); JTL's real API host couldn't be found
  through public research (the guessed one is confirmed wrong); TYPO3 core has no built-in REST
  API for content, so it only works against a site running a specific community extension
  (`cundd/rest`). See each connector file's header comment before touching it.
