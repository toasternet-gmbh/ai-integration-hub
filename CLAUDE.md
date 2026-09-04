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
- `scripts/backup-db.sh` / `scripts/restore-db.sh` — logical backup/restore of this project's
  self-hosted Postgres via `pg_dump`/`pg_restore` run inside the db container. Deliberately
  standalone rather than folded into `deploy.sh`, since that script is shared across other
  projects' deployments too. Not yet wired to a schedule — see their header comments for cron/
  launchd setup and `BACKUP_KEEP_DAYS`/`BACKUP_KEEP_MIN` retention knobs.
- `scripts/remote-forward.sh` (macOS/Linux) / `scripts/remote-forward.ps1` (Windows) — exposes the
  local dev `hub-mcp-server` (via Kong on `VITE_LOCAL_FUNCTIONS_PORT`) to a remote machine with a
  Cloudflare quick tunnel (`cloudflared tunnel --url ...`). Unauthenticated and ephemeral by
  design — see each script's header comment before leaving one running or sharing the URL.

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
`gocardless` banking platform; `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET`/
`MICROSOFT_TENANT_ID` and `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are optional, needed only to
enable the `outlook`/`google` productivity platforms — see `.env.example`'s comments for the
redirect-URI registration requirement (both `/en/...` and `/de/...` variants, or connections fail
with `redirect_uri_mismatch`).

## Known gaps

- As of 2026-09-04, **every** `hub_platform_types` row is `enabled: true` — first this session's
  newly-added connectors (Pipedrive, monday.com, weclapp, Billwerk+/Frisbii, clockin, Clockodo,
  123erfasst, Papershift, openHandwerk, Outlook, Google, Browserless, Steel.dev, Beeper) plus
  GoCardless (`supabase/migrations/20260904000005_enable_new_platforms.sql`), then the last four
  holdouts — DATEV, JTL, TYPO3, HubSpot, Clockify, Contentful
  (`supabase/migrations/20260904000006_enable_all_platforms.sql`; lexoffice, wordpress, toggl,
  sevdesk, and personio had already been flipped live on this project's dev DB by an earlier,
  unmigrated admin action, which that migration also makes reproducible for a fresh deploy). This
  is an explicit founder decision to prioritize agent-facing MCP tool availability over this
  project's usual "tested against a real, fully-authorized customer account" bar before flipping a
  kill switch — the bar PrestaShop's flip in `20260827000009_ecommerce_prestashop_enable.sql` did
  meet. `enabled: true` here does **not** mean verified: every caveat below about unconfirmed
  endpoints, guessed field names, or untested filters still applies exactly as before — the flip
  only means the Policy Engine and `create_integration` no longer block a project from trying a
  platform. Confirm the specific caveat for a platform below before relying on it for a real
  customer.
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
- DATEV and TYPO3 connectors are unverified but now ship `enabled: true` (see the founder-decision
  note above): DATEV requires DATEV Marktplatz partner certification (no public sandbox) — every
  call will fail without it; TYPO3 core has no built-in REST API for content, so it only works
  against a site running a specific community extension (`cundd/rest`). See each connector file's
  header comment before touching it.
- JTL was rewritten 2026-09-03 (`supabase/migrations/20260903000016_jtl_graphql_rewrite.sql`) after
  discovering the original implementation targeted the wrong hosts entirely (`auth.jtl-software.com`
  / `api.jtl-software.com`); the current connector uses `auth.jtl-cloud.com` (OAuth2
  client-credentials) and `api.jtl-cloud.com/erp/v2/graphql` (GraphQL, `X-Tenant-ID` header),
  confirmed against JTL's official SDL schema reference. **Live-verified 2026-09-04**: a real
  `create_integration` call with intentionally-invalid credentials returned a genuine OAuth2 error
  from `auth.jtl-cloud.com` (`"Client authentication failed ... Unable to locate the resource"`),
  not a DNS/connection failure — confirming the host is real and reachable. Still not tested against
  a real, valid JTL Cloud account/tenant, so response shapes for `orders.search`/`products.search`/
  etc. remain schema-confirmed rather than live-confirmed. (An earlier version of this file claimed
  the guessed host was "confirmed wrong" — that described the pre-rewrite connector and was stale;
  corrected here after re-testing.)
- Magento ships `enabled: true` (has since the very first `hub_platform_types` migration) but has
  no verification evidence anywhere — no commit, no prior doc — per
  `supabase/migrations/20260902000000_hub_platform_types_verification_status.sql`. Confirm it
  against a real Magento store before relying on it; it does not belong in the "reaches the real
  API" group above until that happens.
- `outlook` and `google` (productivity: calendar + mail) ship `enabled: true` (see the founder-
  decision note above) despite `MICROSOFT_CLIENT_ID`/`SECRET` and `GOOGLE_CLIENT_ID`/`SECRET` still
  needing to be configured and a real consent-redirect round-trip still not tested end-to-end —
  see `.env.example`'s comments on both. Without those env vars configured, connecting either
  platform will fail at the authorize-URL step regardless of the `enabled` flag.
- `123erfasst` ships `enabled: true` (see the founder-decision note above), same unverified-code
  tier as DATEV: it exposes a GraphQL API whose OAuth token endpoint is assumed discovered
  per-account via an `authProvider` query rather than a fixed public URL. **Live-tested
  2026-09-04**: `POST server.123erfasst.de/graphql` is real (GET/OPTIONS correctly 405 — POST-only,
  as GraphQL endpoints are), but **every** POST — including a bare unauthenticated `{__typename}`
  with no query args — returns a blanket `401` with an empty body. That contradicts this
  connector's core assumption that `authProvider` is a public, unauthenticated discovery query;
  in practice the whole endpoint seems to require some undocumented auth before any query runs at
  all, which the 401's empty body gives no hint about. This is a stronger finding than "unverified"
  — the discovery mechanism the one implemented tool (`projects.search`) depends on may not work
  as designed. See `lib/connectors/erfasst123.ts`'s header comment.
- `papershift` ships `enabled: true` (see the founder-decision note above): its API is a paid
  add-on that Papershift's own sales/CS team must activate before a real `api_token` can even be
  generated, so a genuine round-trip is still untested — but **live-tested 2026-09-04** with a
  deliberately-invalid token confirmed the host/path/param shape are all correct:
  `app.papershift.com/public_api/v1/users` returned a real `401 {"response": "API Key not found!"}`
  — a specific, on-topic application error, not a gateway rejection. That test also caught a real
  bug (fixed in the same pass): the connector's error-message parser only checked `.error`/
  `.message` fields, missing Papershift's actual `.response` field, so this exact error used to get
  swallowed into a generic "Papershift HTTP 401" — see `lib/connectors/papershift.ts`'s `request()`.
- `clockodo`'s connector originally used `/api/v2` uniformly; Clockodo's May 2026 deprecation
  moved `/customers` to `/api/v3` and `/projects` to `/api/v4` (only `/entries` stayed on v2) —
  corrected in the connector, but the exact v3/v4 response envelope shape for a single-resource
  fetch couldn't be confirmed from public docs (a JS-rendered SPA) and needs a live-account check
  before enabling.
- `weclapp` ships `enabled: true` (see the founder-decision note above): only the
  `contacts`/`invoices` slice of its 150+-entity API is implemented, and `/salesInvoice`'s
  line-item field names plus its filter field names for `invoices.search`'s `search`/`status`
  (left unimplemented — throws rather than guessing) aren't independently confirmed against a live
  tenant. **Partially live-tested 2026-09-04**: weclapp is tenant-scoped
  (`https://{tenant}.weclapp.com/...`), so there's no single fixed vendor host to probe the way
  Billwerk+/JTL have — but a request to a made-up tenant subdomain did hit a real `server: weclapp`
  response (a proper 404, not a DNS failure), confirming the tenant-subdomain base-URL pattern
  itself is correct; the `/party` endpoint shape is still unconfirmed since no real tenant exists
  to reach it with. See `lib/connectors/weclapp.ts`'s header comment.
- `billwerk` (Billwerk+/Frisbii) ships `enabled: true` (see the founder-decision note above): it's
  a subscription-billing platform, not a general bookkeeping system, so `invoices.create` maps
  onto a real payment charge (`POST /charge` with `settle: true`) rather than a bookkeeping
  document — the Approvals page surfaces a specific warning for this platform+tool combo, but the
  connector itself, and its `order_lines` field names, aren't independently confirmed against a
  live sandbox account. Its `contacts.search`/`invoices.search` filters are left unimplemented
  (throw rather than guess) for the same reason. **Live-tested 2026-09-04** with a deliberately
  invalid private key: `api.frisbii.com/v1/list/customer` returned a real, detailed
  `400 {"error": "Invalid request", "message": "Not a valid private key", ...}` — confirms host,
  path, and Basic-auth scheme are all correct. That test also caught a real bug (fixed in the same
  pass): the connector checked the generic `.error` field ("Invalid request") before the specific
  `.message` field ("Not a valid private key"), so the actually useful detail was getting hidden
  behind a near-meaningless label — field precedence flipped in `lib/connectors/billwerk.ts`'s
  `request()`.
- `openhandwerk` ships `enabled: true` (see the founder-decision note above) but still implements
  **zero tools** — `getCapabilities()` returns an empty array and every `execute()` call throws
  immediately (`lib/connectors/openhandwerk.ts`'s stub error) — so flipping this to enabled only
  removes the `create_integration` gate, it does not unlock any working tool. Its REST API needs
  10 licenses plus a paid add-on to unlock, and no public developer documentation exists, so
  nothing was safe to implement yet — enabling this platform is purely cosmetic until a real
  implementation lands, unlike DATEV/JTL/TYPO3 above which at least reach a real host.
- `browserless` ships `enabled: true` (see the founder-decision note above). Its per-call
  `assertPublicHttpUrl` check on the target `url` is a real but partial mitigation, not a complete
  one: it pattern-matches literal IPs/hostnames with no DNS resolution (a domain whose A-record
  points at a private/metadata address isn't caught), and the actual fetch happens on Browserless's
  own infrastructure, not this Hub's — so this check protects against careless misuse, not a
  determined one; the real backstop is expected to be Browserless's own network isolation, which
  this Hub doesn't control or verify. **Live-tested 2026-09-04** with an invalid API key:
  `production-sfo.browserless.io/content` returned a real, clean
  `401 "Invalid API key. Please check your API key and try again. (requestId: ...)"` — confirms
  host, path, and the `?token=` auth scheme are all correct. See
  `lib/connectors/browserless.ts`'s header comment.
- `steel` ships `enabled: true` (see the founder-decision note above) with narrower tool coverage
  than Browserless (`browser.get_content` and `browser.screenshot` only — no `browser.scrape`/
  `browser.pdf`, since no one-shot REST endpoint for either could be confirmed on this API). Same
  partial-URL-mitigation caveat as Browserless applies. **Live-tested 2026-09-04** with an invalid
  API key: `api.steel.dev/v1/scrape` returned a real, detailed
  `401 {"error": "Unauthorized", "message": "Invalid Steel API key...", "linkToDocs": "..."}` —
  confirms host, path, and the `steel-api-key` header scheme. That test also caught a real bug
  (fixed in the same pass): the connector threw the raw JSON error body verbatim instead of
  extracting `.message`, so `create_integration`'s `error_status` used to show the whole escaped
  JSON blob instead of a readable sentence — fixed via a small `steelErrorMessage()` helper in
  `lib/connectors/steel.ts` that both `requestJson()`/`requestBinary()` now share.
- `beeper` ships `enabled: true` (see the founder-decision note above): the least precedented
  domain in this codebase (no prior chat/Matrix pattern to build on). `messages.list_rooms`/
  `messages.search` are `medium`/`require_approval` rather than the `low`/`allow` every other read
  tool gets, since Beeper aggregates a person's entire cross-platform personal chat history
  (iMessage/WhatsApp/Telegram/Signal via bridges) and the Policy Engine has no per-room granularity
  to scope that down with. See `lib/connectors/matrix.ts`'s header comment and
  `supabase/migrations/20260904000003_messaging_beeper.sql`'s risk-posture note.
- The public connect/quickconnect/blueprint pages (`src/pages/QuickConnect.tsx`,
  `src/pages/Integrations.tsx`, `src/pages/Blueprint.tsx`, `src/components/PlatformPicker.tsx`) no
  longer render the "Unverified"/"API-verified"/"Real-customer-verified" badge per platform — the
  founder judged it as sending the wrong signal once unverified platforms are also enabled. The
  underlying `verificationStatus` field in `src/lib/platformCatalog.ts` and the DB-backed
  `verification_status` column (editable at `/superadmin/platforms`) are unchanged and still worth
  keeping current — only the public-facing badge render was removed. The caveats in this Known
  Gaps section remain the actual source of truth for what's confirmed vs. guessed per platform.
