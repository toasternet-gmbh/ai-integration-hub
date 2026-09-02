/**
 * Edge Function: hub-mcp-server — AI Integration Hub's MCP gateway.
 *
 * Hand-rolled MCP (Model Context Protocol) server, plain JSON-RPC 2.0 over a single stateless POST
 * per call — "Streamable HTTP" transport, no @modelcontextprotocol/sdk dependency.
 *
 * Auth (lib/mcpAuth.ts): a project-scoped API key ("hub_..."), or a Supabase user JWT + explicit
 * project_id param (a user can belong to several projects, so the JWT alone doesn't say which one).
 *
 * Canonical domain tools (orders.*, see toolRegistry.ts's isGatedTool) act as a specific agent
 * (X-Agent-Id header) and go through the Policy Engine (lib/policy.ts): ALLOW runs immediately,
 * DENY throws, REQUIRE_APPROVAL parks the call in action_approvals and returns
 * {approval_required, approval_id} instead of running it. Every gated call is audit-logged
 * regardless of outcome. Meta/admin tools (create_integration, create_agent, list_approvals, ...)
 * are plain project-member operations with no agent or policy check.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { authenticateMcpRequest, McpAuthError } from "./lib/mcpAuth.ts";
import { recordAudit, resolveActingAgent, resolvePermission } from "./lib/policy.ts";
import { HANDLERS, TOOLS, isGatedTool } from "./toolRegistry.ts";
import type { ToolContext } from "./lib/types.ts";
import { checkRateLimit, getClientIp, isOverLimit, recordHit } from "./lib/rateLimit.ts";

// Coarse anti-abuse backstop, not a precision limiter — see lib/rateLimit.ts for the caveats
// (in-memory, single-container). Three tiers: a generous per-IP cap on all traffic, a much
// tighter per-IP cap on failed auth attempts (slows down API-key/JWT guessing), and a per-identity
// cap on tools/call volume (catches a misconfigured agent looping, not just a hostile client).
const IP_REQUEST_LIMIT = 300;
const IP_REQUEST_WINDOW_MS = 60_000;
const IP_AUTH_FAILURE_LIMIT = 20;
const IP_AUTH_FAILURE_WINDOW_MS = 60_000;
const IDENTITY_TOOL_CALL_LIMIT = 120;
const IDENTITY_TOOL_CALL_WINDOW_MS = 60_000;

const SERVER_INFO = { name: "ai-integration-hub-mcp", version: "0.1.0" };
const PROTOCOL_VERSION = "2024-11-05";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-agent-id, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function ok(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
function toolResult(text: string, isError = false) {
  return { content: [{ type: "text", text }], isError };
}
function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", ...extraHeaders } });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method === "GET") return json({ server: SERVER_INFO, transport: "streamable-http (JSON-RPC POST)" });

  const clientIp = getClientIp(req);
  const ipLimit = checkRateLimit(`ip:${clientIp}`, IP_REQUEST_LIMIT, IP_REQUEST_WINDOW_MS);
  if (!ipLimit.allowed) {
    return json(rpcError(null, -32000, "Rate limit exceeded — too many requests from this address."), 429, { "Retry-After": String(Math.ceil(ipLimit.retryAfterMs / 1000)) });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_INTERNAL_URL") || Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("VITE_SUPABASE_ANON_KEY") || Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || "";
  const admin = createClient(supabaseUrl, serviceKey);

  let rpc: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    rpc = await req.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }
  const { id, method, params } = rpc;

  const authFailureKey = `authfail:${clientIp}`;
  if ((method === "tools/list" || method === "tools/call") && isOverLimit(authFailureKey, IP_AUTH_FAILURE_LIMIT, IP_AUTH_FAILURE_WINDOW_MS)) {
    return json(rpcError(id, -32000, "Too many failed authentication attempts from this address — try again later."), 429);
  }

  try {
    if (method === "initialize") return json(ok(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO }));
    if (method === "notifications/initialized") return new Response(null, { status: 204, headers: CORS });
    if (method === "ping") return json(ok(id, {}));

    if (method === "tools/list") {
      const projectId = params?.project_id ? String(params.project_id) : undefined;
      await authenticateMcpRequest(req, admin, supabaseUrl, anonKey, projectId);
      // Canonical domain tools (orders.*, invoices.*, ...) have a hub_tool_registry row recording
      // which connected platforms actually implement them — meta/admin tools (create_integration,
      // create_agent, ...) don't and are returned as-is. Merging this in here, rather than baking
      // supported_platforms into each tools/*.ts module's static ToolDefinition, keeps
      // hub_tool_registry the single place that answers "which platforms support this tool" —
      // the same table superadmin's Platforms page already edits.
      const { data: registryRows } = await admin.from("hub_tool_registry").select("name, supported_platforms");
      const supportedPlatformsByTool = new Map((registryRows ?? []).map((r: { name: string; supported_platforms: string[] }) => [r.name, r.supported_platforms]));
      const tools = TOOLS.map((t) => {
        const supportedPlatforms = supportedPlatformsByTool.get(t.name);
        return supportedPlatforms ? { ...t, supported_platforms: supportedPlatforms } : t;
      });
      return json(ok(id, { tools }));
    }

    if (method === "tools/call") {
      const toolName = String(params?.name ?? "");
      const toolArgs = (params?.arguments as Record<string, unknown>) ?? {};
      const requestedProjectId = toolArgs.project_id ? String(toolArgs.project_id) : undefined;
      const auth = await authenticateMcpRequest(req, admin, supabaseUrl, anonKey, requestedProjectId);
      const ctx: ToolContext = { admin, projectId: auth.projectId, userId: auth.userId };

      const identityKey = `identity:${auth.projectId}:${auth.userId ?? "apikey"}`;
      const identityLimit = checkRateLimit(identityKey, IDENTITY_TOOL_CALL_LIMIT, IDENTITY_TOOL_CALL_WINDOW_MS);
      if (!identityLimit.allowed) {
        return json(rpcError(id, -32000, "Rate limit exceeded — too many tool calls for this project."), 429, { "Retry-After": String(Math.ceil(identityLimit.retryAfterMs / 1000)) });
      }

      try {
        const handler = HANDLERS[toolName];
        if (!handler) throw new Error(`Unknown tool: ${toolName}`);

        if (isGatedTool(toolName)) {
          const agent = await resolveActingAgent(req, admin, auth.projectId);
          const integrationId = String(toolArgs.integration_id ?? "");
          const decision = await resolvePermission(admin, auth.projectId, agent.id, toolName, integrationId);

          if (decision === "deny") {
            await recordAudit(admin, auth.projectId, agent.id, toolName, integrationId, toolArgs, "denied");
            throw new Error(`Policy denied: agent not permitted to call '${toolName}'.`);
          }
          if (decision === "require_approval") {
            const { requireApproval, notifyApprovalPending } = await import("./lib/policy.ts");
            const approvalId = await requireApproval(admin, auth.projectId, agent.id, toolName, integrationId, toolArgs, auth.userId);
            await recordAudit(admin, auth.projectId, agent.id, toolName, integrationId, toolArgs, "require_approval");
            const hubAppUrl = Deno.env.get("HUB_APP_URL") || "http://localhost:3060";
            await notifyApprovalPending(admin, auth.projectId, toolName, approvalId, hubAppUrl);
            return json(ok(id, toolResult(JSON.stringify({ approval_required: true, approval_id: approvalId }, null, 2))));
          }

          try {
            const result = await handler(toolArgs, ctx);
            await recordAudit(admin, auth.projectId, agent.id, toolName, integrationId, toolArgs, "allowed");
            return json(ok(id, toolResult(JSON.stringify(result, null, 2))));
          } catch (err) {
            await recordAudit(admin, auth.projectId, agent.id, toolName, integrationId, toolArgs, "error", (err as Error).message);
            throw err;
          }
        }

        const result = await handler(toolArgs, ctx);
        return json(ok(id, toolResult(JSON.stringify(result, null, 2))));
      } catch (toolErr) {
        return json(ok(id, toolResult((toolErr as Error).message, true)));
      }
    }

    return json(rpcError(id, -32601, `Method not found: ${method}`), 404);
  } catch (err) {
    if (err instanceof McpAuthError) {
      recordHit(authFailureKey, IP_AUTH_FAILURE_WINDOW_MS);
      return json(rpcError(id, -32001, err.message), 401);
    }
    console.error("[MCP-SERVER] Error:", err);
    return json(rpcError(id, -32603, "Internal error"), 500);
  }
});
