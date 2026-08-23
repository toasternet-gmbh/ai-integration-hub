/**
 * Edge Function: mcp-server — AI Integration Hub's MCP gateway (Milestone 1).
 *
 * Hand-rolled MCP (Model Context Protocol) server, plain JSON-RPC 2.0 over a single stateless POST
 * per call — same "Streamable HTTP" transport as yogaipilot's mcp-server, no @modelcontextprotocol/
 * sdk dependency.
 *
 * Auth (_shared/mcpAuth.ts): a project-scoped API key ("hub_..."), or a Supabase user JWT + explicit
 * project_id param (a user can belong to several projects, so the JWT alone doesn't say which one).
 *
 * Canonical domain tools (orders.*, see toolRegistry.ts's isGatedTool) act as a specific agent
 * (X-Agent-Id header) and go through the Policy Engine (_shared/policy.ts): ALLOW runs immediately,
 * DENY throws, REQUIRE_APPROVAL parks the call in action_approvals and returns
 * {approval_required, approval_id} instead of running it. Every gated call is audit-logged
 * regardless of outcome. Meta/admin tools (create_integration, create_agent, list_approvals, ...)
 * are plain project-member operations with no agent or policy check.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { authenticateMcpRequest, McpAuthError } from "../_shared/mcpAuth.ts";
import { recordAudit, resolveActingAgent, resolvePermission } from "../_shared/policy.ts";
import { HANDLERS, TOOLS, isGatedTool } from "./toolRegistry.ts";
import type { ToolContext } from "../_shared/types.ts";

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

  const supabaseUrl = Deno.env.get("SUPABASE_INTERNAL_URL") || Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("VITE_SUPABASE_ANON_KEY") || "";
  const admin = createClient(supabaseUrl, serviceKey);

  let rpc: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    rpc = await req.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }
  const { id, method, params } = rpc;

  try {
    if (method === "initialize") return json(ok(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO }));
    if (method === "notifications/initialized") return new Response(null, { status: 204, headers: CORS });
    if (method === "ping") return json(ok(id, {}));

    if (method === "tools/list") {
      const projectId = params?.project_id ? String(params.project_id) : undefined;
      await authenticateMcpRequest(req, admin, supabaseUrl, anonKey, projectId);
      return json(ok(id, { tools: TOOLS }));
    }

    if (method === "tools/call") {
      const toolName = String(params?.name ?? "");
      const toolArgs = (params?.arguments as Record<string, unknown>) ?? {};
      const requestedProjectId = toolArgs.project_id ? String(toolArgs.project_id) : undefined;
      const auth = await authenticateMcpRequest(req, admin, supabaseUrl, anonKey, requestedProjectId);
      const ctx: ToolContext = { admin, projectId: auth.projectId, userId: auth.userId };

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
            const { requireApproval } = await import("../_shared/policy.ts");
            const approvalId = await requireApproval(admin, auth.projectId, agent.id, toolName, integrationId, toolArgs, auth.userId);
            await recordAudit(admin, auth.projectId, agent.id, toolName, integrationId, toolArgs, "require_approval");
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
    if (err instanceof McpAuthError) return json(rpcError(id, -32001, err.message), 401);
    console.error("[MCP-SERVER] Error:", err);
    return json(rpcError(id, -32603, "Internal error"), 500);
  }
});
