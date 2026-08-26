# Support Ticket System — Working Guide

Platform: [support-ai-ze.de](https://support-ai-ze.de)
Manage API keys: https://support-ai-ze.de/app/api-keys

---

## Quick Reference

| | Value |
|---|---|
| **API Key** | `saz_28d9634b3a038d8364186ce14438ba0057906132e3090d500b413746aef8004f` |
| **Base URL** | `https://kbhoaohvxwrvenbegcdh.supabase.co/functions/v1` |
| **project_id** | `bd1f223f-587b-4932-9649-4c5a43fc4466` (this project is named **"YogAIPilot"** in the support system) |
| **tenant_id** | `c2099e13-9520-4b1c-bde0-d763e2cb45d4` |
| **customer_id** | `3d92fa50-024e-4334-a730-b1deb56f2ee1` |

---

## MCP Server

An MCP (Model Context Protocol) server is now live for the support ticket system, letting an AI assistant (Claude, etc.) read/manage tickets directly.

| | Value |
|---|---|
| **Server URL** | `https://kbhoaohvxwrvenbegcdh.supabase.co/functions/v1/mcp-server` |
| **Protocol** | JSON-RPC 2.0 / MCP `2024-11-05`, `serverInfo.name` = `support-ai-ze` |
| **Auth** | Bearer API key (`Authorization: Bearer saz_...`), or OAuth (see below). `tools/list` works unauthenticated (schema discovery is public); every `tools/call` requires auth. |
| **CORS** | `Access-Control-Allow-Origin: *` — callable directly from a browser. |

### Connecting

**claude.ai (Web) — Custom Connector, OAuth, no API key needed:**
1. Claude → Settings → Connectors → Add custom connector
2. Server URL: `https://kbhoaohvxwrvenbegcdh.supabase.co/functions/v1/mcp-server`
3. Claude opens a login page — sign in with your support-ai-ze.de account. OAuth discovery confirmed at `.../mcp-server/.well-known/oauth-authorization-server` (authorization endpoint `https://www.support-ai-ze.de/oauth/authorize`, PKCE S256, dynamic client registration supported).

**Claude Desktop — API key via `mcp-remote`:**
```json
{
  "mcpServers": {
    "support-ai-ze": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://kbhoaohvxwrvenbegcdh.supabase.co/functions/v1/mcp-server",
        "--header",
        "Authorization: Bearer <YOUR_API_KEY>"
      ]
    }
  }
}
```

**Raw HTTP (curl):**
```bash
curl -X POST "https://kbhoaohvxwrvenbegcdh.supabase.co/functions/v1/mcp-server" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer saz_..." \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_tickets","arguments":{"project_id":"bd1f223f-587b-4932-9649-4c5a43fc4466"}}}'
```

### Available tools (30, verified 2026-07-21)

**Tickets**
- `list_tickets` — filter by `project_id`/`status`, sort, paginate. Includes recent messages/documents/time entries per ticket.
- `get_ticket` — one ticket + its full conversation.
- `create_ticket` — subject, body, project_id, customer_name, priority, optional linked commit.
- `update_ticket` — partial update (status, priority, assignee, project, linked commit, ...).
- `create_subticket` / `list_subtickets` / `update_subticket` — checklist-style sub-tickets under a parent ticket.
- `add_message` — reply or internal note on a ticket.
- `list_messages` — conversation history, filter by ticket or project.

**Time tracking**
- `add_time` / `update_time` — actual time entries (duration or start/end).
- `add_plan_time` / `update_plan_time` — planned time entries (draft/sent/approved/rejected).

**Documents & images**
- `add_document` / `update_document` — attach file metadata (upload to Supabase Storage separately, pass the URL).
- `add_image_to_message` / `add_image_to_document` — upload an image (base64 or URL) directly.

**Projects & customers**
- `list_projects` — all projects on the tenant (⚠️ not filtered to this project — see note above).
- `list_customers`.
- `get_embed_snippet` — the support chat widget `<script>` snippet for a project.

**AI memory / todo** (scratchpad the assistant can use across sessions)
- `create_ai_memory_item` / `list_ai_memory_items` / `update_ai_memory_item` / `delete_ai_memory_item`
- `create_ai_todo_item` / `list_ai_todo_items` / `update_ai_todo_item` / `delete_ai_todo_item`

**Batch & admin**
- `batch_tools` — run up to 200 tool calls in one request.
- `search_commits_by_author` — admin-only, searches GitHub commits across the tenant's connected repos.

An in-dashboard reference page mirroring this (connection info + live tool test panel) is available at **Dashboard → Manage → MCP Settings** (`/dashboard/mcp-settings`, admin-only).
