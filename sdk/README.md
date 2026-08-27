# @ai-integration/hub

Official JavaScript/TypeScript client for the [AI Integration Hub](https://github.com/toasternet-gmbh/ai-integration-hub)'s MCP gateway — lets your AI agent or backend script call canonical tools (`orders.refund`, `invoices.search`, `cms.pages.get`, `accounts.list`, ...) against whatever platform you've connected in the Hub console, with the Hub's Policy Engine and audit log applying automatically.

## Install

This package is not yet published to the public npm registry. Until it is, install it directly from this repo:

```bash
npm install github:toasternet-gmbh/ai-integration-hub#path:sdk
```

or, working inside a clone of this monorepo:

```bash
cd sdk && npm install && npm run build
npm install ../path/to/ai-integration-hub/sdk   # from your own project
```

## Requirements

- Node.js 18+ (needs global `fetch`), or any environment with a `fetch` implementation passed via `options.fetch`.
- A project API key from the Hub console's **API Keys** page (starts with `hub_`).
- Your Hub's MCP gateway URL — `https://<project>.supabase.co/functions/v1/hub-mcp-server` for the hosted Hub, or your own deployment's equivalent.

## Usage

```ts
import { HubClient } from "@ai-integration/hub";

const client = new HubClient({
  baseUrl: process.env.HUB_BASE_URL!,
  apiKey: process.env.HUB_API_KEY!,
  agentId: "my-support-agent", // which Hub agent this process acts as; required by most tools
});

const orders = await client.tools.orders.search({
  integration_id: "int_...",
  status: "pending_approval",
  limit: 10,
});
```

Any canonical tool works through `client.tools.<dot.path>(input)` — including nested ones like CMS pages:

```ts
const pages = await client.tools.cms.pages.search({ integration_id: "int_...", search: "pricing" });
```

Or call a tool by its exact name directly — useful for a tool this SDK version has no typed shortcut for yet:

```ts
const result = await client.call("some.new.tool", { integration_id: "int_..." });
```

## Handling `require_approval`

A tool call whose policy is "Require approval" does **not** throw and does **not** run the action — it resolves with `{ approval_required: true, approval_id }` instead of the tool's normal result:

```ts
import { isApprovalRequired } from "@ai-integration/hub";

const result = await client.tools.orders.refund({ integration_id: "int_...", order_id: "ORD-8821A", reason: "..." });

if (isApprovalRequired(result)) {
  // Tell the end user / your own reasoning that this needs human sign-off, then stop.
  // Don't retry the same call, and don't poll in a tight loop.
  console.log(`Waiting on approval ${result.approval_id}`);
} else {
  // result is the tool's real, already-executed output.
}
```

## Errors

Both JSON-RPC-level errors (bad auth, unknown tool) and tool-execution errors (the underlying platform rejected the call — e.g. WooCommerce returned 404) throw `HubApiError`:

```ts
import { HubApiError } from "@ai-integration/hub";

try {
  await client.tools.orders.get({ integration_id: "int_...", order_id: "nope" });
} catch (e) {
  if (e instanceof HubApiError) {
    console.error(e.toolName, e.message); // "orders.get" "Order nope not found"
  }
}
```

## `X-Agent-Id`

Most canonical tools (`orders.*`, `invoices.*`, ...) require an `X-Agent-Id` header naming which Hub agent is acting — set a default via `agentId` in the constructor, or override it per call:

```ts
await client.tools.orders.get(
  { integration_id: "int_...", order_id: "ORD-1" },
  { agentId: "a-different-agent" },
);
```

## API keys vs. user sessions

This client is built for **API-key auth only** (server-side agents, scripts, backends) — an API key is already scoped to one Hub project, so you never pass a `project_id`. Signed-in human users in the Hub's own web console authenticate differently (a Supabase session JWT plus an explicit `project_id`); that path isn't exposed by this SDK.

## Development (this repo)

```bash
cd sdk
npm install
npm run typecheck
npm run test
npm run build
```
