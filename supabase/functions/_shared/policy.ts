/**
 * Policy Engine — resolves an agent's permission for one tool call, and the audit/approval
 * bookkeeping around it. Mirrors yogaipilot's _shared/mcpAgentAuthz.ts `resolveRule` resolution
 * order and mcpPolicy.ts's recordAudit/requireApproval, generalized to read agent_tool_permissions
 * from the database instead of a static in-code table (this Hub has no fixed tool set — tools vary
 * per connected platform).
 */

// deno-lint-ignore no-explicit-any
type Admin = any;

export type PolicyDecision = "allow" | "deny" | "require_approval";
export type AuditStatus = "allowed" | "denied" | "require_approval" | "error";

export interface ActingAgent {
  id: string;
}

/** Resolves the acting agent from the X-Agent-Id header, verified against the project. */
export async function resolveActingAgent(req: Request, admin: Admin, projectId: string): Promise<ActingAgent> {
  const agentId = req.headers.get("x-agent-id") ?? req.headers.get("X-Agent-Id");
  if (!agentId) throw new Error("X-Agent-Id header is required — every tool call acts as a specific agent.");
  const { data, error } = await admin.from("agents").select("id, status").eq("id", agentId).eq("project_id", projectId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Agent ${agentId} not found in this project`);
  if (data.status !== "active") throw new Error(`Agent ${agentId} is disabled`);
  return { id: data.id };
}

/** Most-specific-wins: (agent,tool,integration) -> (agent,tool,*) -> tool_registry.default_policy. */
export async function resolvePermission(
  admin: Admin,
  projectId: string,
  agentId: string,
  toolName: string,
  integrationId: string,
): Promise<PolicyDecision> {
  const { data: rows, error } = await admin
    .from("agent_tool_permissions")
    .select("integration_id, permission")
    .eq("project_id", projectId).eq("agent_id", agentId).eq("tool_name", toolName)
    .in("integration_id", [integrationId, null]);
  if (error) throw new Error(error.message);
  const specific = (rows ?? []).find((r: { integration_id: string | null }) => r.integration_id === integrationId);
  if (specific) return specific.permission as PolicyDecision;
  const wildcard = (rows ?? []).find((r: { integration_id: string | null }) => r.integration_id === null);
  if (wildcard) return wildcard.permission as PolicyDecision;

  const { data: tool, error: toolErr } = await admin.from("tool_registry").select("default_policy").eq("name", toolName).maybeSingle();
  if (toolErr) throw new Error(toolErr.message);
  return (tool?.default_policy as PolicyDecision) ?? "deny";
}

export async function recordAudit(
  admin: Admin,
  projectId: string,
  agentId: string | null,
  toolName: string,
  integrationId: string | null,
  input: Record<string, unknown>,
  status: AuditStatus,
  errorMessage?: string,
): Promise<void> {
  const { error } = await admin.from("audit_logs").insert({
    project_id: projectId, agent_id: agentId, tool_name: toolName, integration_id: integrationId,
    input, status, error_message: errorMessage ?? null,
  });
  if (error) console.error("[policy] failed to write audit_logs:", error.message);
}

export async function requireApproval(
  admin: Admin,
  projectId: string,
  agentId: string,
  toolName: string,
  integrationId: string,
  input: Record<string, unknown>,
  requestedBy: string | null,
): Promise<string> {
  const { data, error } = await admin
    .from("action_approvals")
    .insert({ project_id: projectId, agent_id: agentId, tool_name: toolName, integration_id: integrationId, input, status: "pending", requested_by: requestedBy })
    .select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}
