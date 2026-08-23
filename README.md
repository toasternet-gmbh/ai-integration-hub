# AI Integration Hub — Milestone 1

A standalone "AI Integration & Agent Control Platform" — lets AI agents safely call external
business systems (WooCommerce first) through a normalized set of canonical tools (`orders.get`,
`orders.search`, `orders.refund`), gated by a Policy Engine + human-approval flow + audit log.

See the design/scope rationale in the plan this was built from (self-hosted Supabase stack, reusing
patterns proven in the `yogaipilot` repo's `mcp-server`).

## Stack

Self-hosted Supabase (Postgres + GoTrue + PostgREST + Kong + Deno Edge Functions), Docker Compose +
Caddy/Cloudflare Tunnel, deployed with `deploy.sh` (copied from `yogaipilot`, same tool — see its own
`--help` comments). Frontend: plain React + Vite, deliberately undecorated for Milestone 1 (no
Tailwind/shadcn yet — see "Explicitly deferred" below).

## What's implemented (Milestone 1)

- **Schema** (`supabase/migrations/20260823000000_core_schema.sql`): Organization → Project →
  {Integration, Agent, ApiKey}, `agent_tool_permissions` (allow/deny/require_approval,
  most-specific-wins by (agent, tool, integration)), `action_approvals`, `audit_logs`, `tool_registry`
  seeded with `orders.search` / `orders.get` / `orders.refund`.
- **MCP gateway** (`supabase/functions/mcp-server/`): hand-rolled JSON-RPC 2.0 server. Auth via a
  project-scoped API key (`hub_...`) or a Supabase JWT + explicit `project_id` (a user can belong to
  several projects). Canonical `orders.*` tools run through the Policy Engine
  (`_shared/policy.ts`) — ALLOW runs now, DENY throws, REQUIRE_APPROVAL parks the call in
  `action_approvals` and returns `{approval_required, approval_id}`. Every gated call is
  audit-logged. Meta tools (`create_integration`, `create_agent`, `list_approvals`, `resolve_approval`,
  ...) are plain project-member operations, no agent/policy involved.
- **Approve = execute now** (`tools/approvals.ts::resolve_approval`): atomically claims the pending
  row (`UPDATE ... WHERE status='pending'`) before running the connector call — carried over from a
  real double-execution race found and fixed in `yogaipilot`'s equivalent code this same session.
- **WooCommerce connector** (`_shared/connectors/woocommerce.ts`): REST API v3, Consumer Key/Secret
  Basic Auth. `orders.search` / `orders.get` / `orders.refund` (→ `POST /orders/{id}/refunds`).
  Credentials encrypted at rest (`_shared/crypto.ts`, AES-256-GCM) before insert, decrypted only
  inside the edge function right before the connector call.
- **Frontend** (`src/App.tsx`): sign in/up, create-or-pick Organization → Project, then a project
  dashboard with 4 tabs — Integrations (connect WooCommerce, see status), Agents (create agent, grant
  a tool permission), Approvals (list pending, approve/deny — approve runs the real refund), Audit
  Logs. Verified: `npm install && npx tsc --noEmit` is clean, and the app renders/serves via
  `npm run dev`.

## What's NOT done yet

1. **No live backend deployed.** No self-hosted Supabase instance has been stood up for this project
   — `deploy.sh` has been copied and lightly adapted (repo name, `CREDENTIALS_ENCRYPTION_KEY`
   plumbing) but never run. Until it is, there's nothing at a real URL to point the frontend at.
2. **No real WooCommerce store tested against.** The connector code is written against the documented
   WooCommerce REST API v3 shape but has not been exercised against a live store.
3. **`bun.lockb` doesn't exist yet** — `deploy.sh`'s production Dockerfile `COPY`s it; run
   `bun install` (or adjust the Dockerfile to `npm install`, since this repo actually used `npm`) once
   before the first real deploy.
4. Full end-to-end proof (blueprint's two flows: `orders.get` ALLOW, `orders.refund`
   REQUIRE_APPROVAL → approve → real refund, audit trail visible) has **not been run live** — it
   needs (1) and (2) above first.

## To actually prove this end-to-end

```bash
# 1. Stand up the stack (see deploy.sh's own header comments for all flags/env keys)
cp .env.example .env.supabase   # fill in a real domain, generate CREDENTIALS_ENCRYPTION_KEY:
openssl rand -base64 32
./deploy.sh toasternet/ai-integration-hub

# 2. Point the frontend at it (VITE_SUPABASE_URL etc. from the generated .env.supabase),
#    sign up, create an Organization + Project, connect a real (or WooCommerce sandbox) store,
#    create an Agent, leave orders.refund at its require_approval default, call orders.get and
#    orders.refund (via the UI or a raw curl to the MCP JSON-RPC endpoint), approve the refund,
#    confirm it landed in the store and in Audit Logs.
```

## Explicitly deferred (Milestone 2+)

Shopify/WordPress connectors, conditional Policy Engine (amount thresholds), published
`@org/integration-sdk` npm package, full UI polish (Tailwind/shadcn), Redis/BullMQ background jobs
(webhooks/retries/async sync) — see the plan this was built from for the full reasoning.
