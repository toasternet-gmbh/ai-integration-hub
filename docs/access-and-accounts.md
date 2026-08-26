# Access & Accounts — AI Integration Hub

Local-dev reference: URLs, logins, credentials. **Contains real local-only passwords — never
commit publicly, never reuse anywhere real.** Already gitignored.

Last updated: 2026-08-25 (moved every account onto its real email — see below).

## Quick start — log in locally

1. Make sure Docker is up: `docker ps` should show `yogaipilot-supabase-*` containers healthy.
2. `npm run dev` in this repo → http://localhost:3060
3. Sign in with one of:

   | Email | Password | Role |
   |---|---|---|
   | `support@innov-ai-tive.de` | `HubTest123!` | **Platform admin** (superadmin) — no org membership, goes straight to `/en/superadmin` |
   | `support@yogaipilot.com` | `HubTest123!` | Owner of org **Toasternet** / project **YogaPilot Merch** (3 integrations, 1 agent, real audit history) |
   | `member@yogaipilot.com` | `HubTest123!` | Regular member, same org/project |

   All three verified working 2026-08-25.

   These used to be a single dual-role account (`hub-test@yogaipilot.local`, both org owner and
   platform admin) plus a throwaway `woo-ai-test1@yopmail.com` member — split into real,
   role-specific emails on 2026-08-25: renamed the org-owner account to `support@yogaipilot.com`,
   renamed the member account to `member@yogaipilot.com`, created a brand new
   `support@innov-ai-tive.de` account and made *that* one the platform admin (transferred the role
   off the org-owner account — a platform admin no longer needs to also own a demo org). All done
   via GoTrue's admin API (`PUT/POST /auth/v1/admin/users`) directly against the local stack —
   nothing in the app's own UI does this yet.

## Platform admin (superadmin)

A role above all org/project membership — manages every organization, every Hub user, the
Hub-wide tool/platform catalog, and Hub-wide settings. Added 2026-08-25; didn't exist before.

- Granted via the `hub_platform_admins` table (not a role string on an existing membership row).
- `support@innov-ai-tive.de` is the only platform admin right now — a dedicated account with no
  org membership of its own (see "Quick start" above for how it got there).
- Grant/revoke more from the UI itself: `/en/superadmin/admins` — refuses to revoke the last one.
- Backend tools live in `yogaipilot/supabase/functions/hub-mcp-server/tools/platformAdmin.ts` —
  committed there now (`c683934`), along with the rest of `hub-mcp-server/` (`937b847`), which
  hadn't been tracked in that repo's git before.

### Login was broken — root cause & fix (2026-08-25)

`.env` and `.env.local` had `VITE_SUPABASE_URL` pointed at `https://api.yogaipilot.com` — a
**different, remote** Supabase project that this test user doesn't exist in. The correct target is
the **local shared stack** at `http://localhost:54321`. Both files are fixed now to point there
with the current anon key (the stack's Kong config uses the standard Supabase self-host demo key,
declared in `yogaipilot/docker/kong/kong.yml`).

If login breaks again, check `VITE_SUPABASE_URL` in `.env`/`.env.local` first — it must be
`http://localhost:54321`, not any `https://...` remote host. (`.env.supabase` is unrelated — that
one's only read by `deploy.sh` for production deploys, not by `npm run dev`.)

Old login `e2e-test@ai-integration-hub.local` / `TestPassword123!` — **still not usable**, it only
exists on the old standalone Supabase stack, which is stopped (not deleted). Ignore unless that
stack gets restarted.

## Where everything runs

The Hub shares yogaipilot's local Supabase (Postgres + Auth + Kong) instead of running its own
stack. Its own standalone stack is stopped, not deleted, in case of rollback.

| What | Value |
|---|---|
| Frontend (Vite dev) | http://localhost:3060 (`npm run dev`) |
| Supabase API (Kong) | http://localhost:54321 (tunnel: `https://yoga-api.osypus.cloud`) |
| Edge function | `hub-mcp-server` at `yogaipilot/supabase/functions/hub-mcp-server/` (bind-mounted — edit directly, then `docker restart yogaipilot-functions`; env var changes need `docker compose --env-file .env.docker up -d functions` instead) |
| DB tables | All `hub_`-prefixed, e.g. `hub_organizations`, `hub_projects`, `hub_integrations` — kept separate from yogaipilot's own same-named-concept tables |
| This repo | `~/development/ai-integration-hub` — frontend only; backend code lives in `yogaipilot/supabase/functions/hub-mcp-server/` now (single source of truth). No git remote, no off-machine backup. |

**Known unrelated issue**: `yogaipilot-realtime` container is crash-looping (missing `workerd`
binary). Doesn't affect Hub login or API calls (Auth/Kong/Postgres/Functions are all healthy) —
leave it, not a Hub problem.

## Company / legal identity

- **Innov-AI-tive GmbH** — Bahnhofplatz 1, 91054 Erlangen, Germany
- Managing Director: Tobias Hartmann · Commercial Register: Amtsgericht Fürth, HRB 13346
- Contact: info@innov-ai-tive.de · www.innov-ai-tive.de

## Email delivery (Resend)

`RESEND_API_KEY` in `yogaipilot/.env.docker` powers both `send_email`/approval notifications and
GoTrue's password-reset/invite emails. **No verified sending domain yet** → Resend only delivers to
`tobias.hartmann@toasternet.eu`; every other recipient gets a clean 403 (surfaced as an error, not a
silent failure). Verify a domain at [resend.com/domains](https://resend.com/domains) to unlock real
delivery — no code changes needed after that.

Team invites don't need Resend — they hand back a raw GoTrue link to copy/send manually.

## Support tickets

- System: support-ai-ze.de (MCP JSON-RPC — key in `yogaipilot/docs/support-ticket-system.md`)
- No dedicated Hub project yet — filed under **YogAIPilot** (`bd1f223f-587b-4932-9649-4c5a43fc4466`)
- Filed so far: `42a4bcc4`, `3a1f9905`, `79db70ec`, `1f51024f`

## Cloudflare Tunnel (public URLs for test stores)

Config: `~/.cloudflared/commerce-shops.yml` (tunnel `220af1f8-86dc-498e-a927-d0341077c427`, auto-runs
via `~/Library/LaunchAgents/com.cloudflare.commerce-shops.plist`).

- `https://woocommerce.osypus.cloud` → `127.0.0.1:8090`
- `https://shopware.osypus.cloud` → `127.0.0.1:8091`
- `https://magento.osypus.cloud` → `127.0.0.1:8092`

## Test commerce platforms

Containers: `~/development/commerce-test-stores/docker-compose.yml`.

### WooCommerce

| What | Value |
|---|---|
| URL | https://woocommerce.osypus.cloud (local: `:8090`) |
| wp-admin | `admin` / `WooTest2026!` |
| REST API key | Regenerate via WooCommerce → Settings → Advanced → REST API if needed (current one is stored encrypted in the Hub's integration record) |
| Test data | "Yoga Mat Pro" ($39.90, id 11); orders #12, #14 (refunded via the Hub) |

### Shopware 6

| What | Value |
|---|---|
| URL | https://shopware.osypus.cloud (local: `:8091`) |
| Admin panel | `/admin` — `admin` / `ShopwareTest2026!` |
| Admin API | OAuth2 client created via Settings → System → Integrations — current pair stored encrypted in the Hub's integration record |

### Shopify — needs your input, not yet connected to a real store

Connector code is done and smoke-tested (fake shop domain → correctly handled "Not Found"), but no
real store exists yet since Shopify has no self-hostable image. To connect one, you'd need to:

1. Create a free Shopify Partner account + dev store
2. Add a custom app (Admin API scopes `read_orders` + `write_orders`)
3. Get its Admin API token (`shpat_...`) and paste it into the Hub's "Connect a store" flow directly
   (never store it here)

### Magento 2 (Mage-OS) — live, real-order tested

| What | Value |
|---|---|
| URL | https://magento.osypus.cloud (local: `:8092`, redirects to public URL) |
| Admin panel | `/admin_anqeak1` — `admin` / `MagentoTest2026!` |
| REST auth | Admin token via `POST /rest/V1/integration/admin/token` (~4h lifetime) |
| Test data | Product `yoga-mat-pro` ($39.90, qty 99); order #1, invoiced then refunded via the Hub — verified against Magento's own API (credit memo #1, `state: refunded`) |

**Container quirk**: `bin/magento` CLI run via `docker exec` writes files as `root` (PHP-FPM runs as
`application`), breaking dev-mode autogeneration. Run `chown -R application:application /app` after
any `bin/magento setup:upgrade` / `cache:flush` / `module:enable`.

**Admin panel is JS-broken (2026-08-25)**: `pub/static/adminhtml/...` 404s — the admin theme's
static assets never got generated (ownership under `/app/var`/`/app/generated`/`/app/pub/static`
looks fine, so it's not the chown quirk above; likely the dev-mode static-content fallback isn't
wired through this container's web server). Admin pages render as unstyled raw HTML and JS-bound
buttons (e.g. "Add New Integration") silently no-op. Not investigated further — work around it via
the REST API directly instead of the Integrations grid.

**Hub's stored Magento credential (updated 2026-08-25)**: the original credential was a real
OAuth Integration token scoped to Sales/Orders only — fine for `orders.*`, but calling
`products.*`/`inventory.*` failed with `"The consumer isn't authorized to access %resources."`
(Magento's stock message for an Integration token missing a resource in its ACL). Couldn't fix that
Integration's resource list because it no longer exists in the Admin grid (0 records — someone
deleted it after issuing the token, which doesn't revoke already-issued tokens) and the Admin UI is
JS-broken (see above) so a replacement Integration can't be created there either.

Worked around it by swapping the Hub's stored credential to a fresh `admin/token` (inherits the
`admin` user's full Administrators role, so it has Catalog access too) via direct DB update +
`test_integration_connection` — same mechanism as the "quick tests" row above, just applied to the
live credential instead of a one-off curl. **This token expires ~4h after it was minted**, unlike
the old Integration token. When Magento calls through the Hub start failing again with an auth
error, regenerate one the same way:
```
curl -s -X POST "https://magento.osypus.cloud/rest/V1/integration/admin/token" \
  -H "Content-Type: application/json" -d '{"username":"admin","password":"MagentoTest2026!"}'
```
then re-encrypt `{"storeUrl":"https://magento.osypus.cloud","accessToken":"<token>"}` with
`CREDENTIALS_ENCRYPTION_KEY` (AES-256-GCM, see `lib/crypto.ts`) and update the
`hub_integrations.credentials_encrypted` row for the Magento integration, then call
`test_integration_connection` to clear its status. A real long-lived Integration (once the Admin UI
static-asset issue is fixed) would avoid this entirely.

## Secrets

- `CREDENTIALS_ENCRYPTION_KEY` (AES-256-GCM, encrypts integration credentials at rest) — in `.env`
- Supabase JWT secret / service role / anon key — in `.env` and `.env.local`
