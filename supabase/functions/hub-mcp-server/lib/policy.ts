/**
 * Policy Engine — resolves an agent's permission for one tool call, and the audit/approval
 * bookkeeping around it. Reads agent_tool_permissions from the database instead of a static
 * in-code table, since this Hub has no fixed tool set — tools vary per connected platform.
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
  const { data, error } = await admin.from("hub_agents").select("id, status").eq("id", agentId).eq("project_id", projectId).maybeSingle();
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
  const { data: tool, error: toolErr } = await admin.from("hub_tool_registry").select("default_policy, enabled").eq("name", toolName).maybeSingle();
  if (toolErr) throw new Error(toolErr.message);
  // A platform admin disabling a tool Hub-wide is a hard off switch, checked before any per-agent
  // override below — unlike default_policy (just a fallback), this can't be re-allowed per agent.
  if (tool && tool.enabled === false) return "deny";

  // SQL IN never matches NULL (three-valued logic), and PostgREST's .in() serializes a JS `null`
  // element as the literal string "null" rather than dropping to IS NULL — need an explicit OR.
  const { data: rows, error } = await admin
    .from("hub_agent_tool_permissions")
    .select("integration_id, permission")
    .eq("project_id", projectId).eq("agent_id", agentId).eq("tool_name", toolName)
    .or(`integration_id.eq.${integrationId},integration_id.is.null`);
  if (error) throw new Error(error.message);
  const specific = (rows ?? []).find((r: { integration_id: string | null }) => r.integration_id === integrationId);
  if (specific) return specific.permission as PolicyDecision;
  const wildcard = (rows ?? []).find((r: { integration_id: string | null }) => r.integration_id === null);
  if (wildcard) return wildcard.permission as PolicyDecision;

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
  const { error } = await admin.from("hub_audit_logs").insert({
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
    .from("hub_action_approvals")
    .insert({ project_id: projectId, agent_id: agentId, tool_name: toolName, integration_id: integrationId, input, status: "pending", requested_by: requestedBy })
    .select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** Best-effort email to every project owner when an action parks in the approvals inbox — otherwise
 *  the only way to notice is polling the UI. Never throws: a broken/unconfigured mailer (e.g. no
 *  verified Resend domain yet) must not fail the underlying tool call, which has already succeeded
 *  in creating the approval row by the time this runs. */
export async function notifyApprovalPending(
  admin: Admin,
  projectId: string,
  toolName: string,
  approvalId: string,
  hubAppUrl: string,
): Promise<void> {
  try {
    const { sendEmail } = await import("../../_shared/email.ts");
    const { data: project } = await admin.from("hub_projects").select("name").eq("id", projectId).maybeSingle();
    const { data: owners } = await admin.from("hub_project_members").select("user_id").eq("project_id", projectId).eq("role", "owner");
    const projectName = project?.name ?? "your project";
    const link = `${hubAppUrl}/app/approvals`;
    for (const owner of owners ?? []) {
      const { data: authData } = await admin.auth.admin.getUserById(owner.user_id);
      const email = authData?.user?.email;
      if (!email) continue;
      await sendEmail(
        email,
        `Approval needed: ${toolName} on ${projectName}`,
        `<p>An agent on <strong>${projectName}</strong> wants to run <code>${toolName}</code> and it requires your approval.</p><p><a href="${link}">Review it in the Approvals Inbox</a></p>`,
      );
    }
  } catch (err) {
    console.error(`[policy] notifyApprovalPending failed for approval ${approvalId}:`, (err as Error).message);
  }
}
