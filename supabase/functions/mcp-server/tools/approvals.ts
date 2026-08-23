/**
 * Approval inbox. Approving executes the connector call immediately — there is no "agent retries
 * and this time it's allowed" path, so `resolve_approval` must atomically claim the row before
 * executing (UPDATE ... WHERE status='pending') exactly like yogaipilot's
 * mcp-server/tools/aiApprovals.ts::resolve_ai_action_approval — that codebase hit a real
 * double-execution race here (two concurrent approvals both passing a SELECT-then-UPDATE check and
 * both firing a refund) before landing on this atomic-claim pattern. Carried over verbatim.
 */
import type { ToolContext, ToolDefinition, ToolModule } from "../../_shared/types.ts";
import { recordAudit } from "../../_shared/policy.ts";
import { loadConnector } from "../../_shared/connectors/factory.ts";

export const definitions: ToolDefinition[] = [
  {
    name: "list_approvals",
    description: "List action approvals for this project.",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string", enum: ["pending", "denied", "approved", "executed"], description: "Default pending." }, limit: { type: "number" } },
    },
  },
  {
    name: "count_pending_approvals",
    description: "Count pending approvals — for a dashboard badge.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "resolve_approval",
    description: "Approve or deny a pending action. Approving executes the underlying tool call immediately.",
    inputSchema: {
      type: "object",
      required: ["approval_id", "decision"],
      properties: { approval_id: { type: "string" }, decision: { type: "string", enum: ["approve", "deny"] } },
    },
  },
  {
    name: "list_audit_logs",
    description: "List the audit trail of every gated tool call the Policy Engine has seen.",
    inputSchema: {
      type: "object",
      properties: { tool_name: { type: "string" }, status: { type: "string", enum: ["allowed", "denied", "require_approval", "error"] }, limit: { type: "number" } },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async list_approvals(args, { admin, projectId }) {
    const { data, error } = await admin
      .from("action_approvals").select("id, agent_id, tool_name, integration_id, input, status, requested_by, approved_by, decided_at, result, created_at")
      .eq("project_id", projectId).eq("status", args.status ? String(args.status) : "pending")
      .order("created_at", { ascending: false }).limit(Number(args.limit ?? 50));
    if (error) throw new Error(error.message);
    return data;
  },

  async count_pending_approvals(_args, { admin, projectId }) {
    const { count, error } = await admin.from("action_approvals").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "pending");
    if (error) throw new Error(error.message);
    return { pending: count ?? 0 };
  },

  async resolve_approval(args, ctx: ToolContext) {
    const { admin, projectId, userId } = ctx;
    const approvalId = String(args.approval_id ?? "");
    const decision = String(args.decision ?? "");
    if (!approvalId) throw new Error("approval_id is required.");
    if (decision !== "approve" && decision !== "deny") throw new Error("decision must be 'approve' or 'deny'.");

    const nowIso = new Date().toISOString();
    const claimStatus = decision === "approve" ? "approved" : "denied";

    // Atomic claim — see file header. Whichever concurrent call's UPDATE lands first wins the row;
    // the loser's WHERE clause (status='pending') matches zero rows.
    const { data: claimed, error: claimErr } = await admin
      .from("action_approvals")
      .update({ status: claimStatus, approved_by: userId, decided_at: nowIso })
      .eq("id", approvalId).eq("project_id", projectId).eq("status", "pending")
      .select("id, agent_id, tool_name, integration_id, input")
      .maybeSingle();
    if (claimErr) throw new Error(claimErr.message);
    if (!claimed) throw new Error("Approval not found or already decided.");

    if (decision === "deny") {
      await recordAudit(admin, projectId, claimed.agent_id, claimed.tool_name, claimed.integration_id, claimed.input ?? {}, "denied");
      return { id: approvalId, status: "denied" };
    }

    const { data: integration, error: intErr } = await admin
      .from("integrations").select("id, platform, credentials_encrypted, status").eq("id", claimed.integration_id).eq("project_id", projectId).maybeSingle();
    if (intErr) throw new Error(intErr.message);
    if (!integration) throw new Error("Integration no longer exists — approval recorded as approved but not executed.");

    try {
      const connector = await loadConnector(integration);
      const result = await connector.execute(claimed.tool_name, (claimed.input ?? {}) as Record<string, unknown>);
      const { error: updErr } = await admin.from("action_approvals").update({ status: "executed", result: result.data }).eq("id", approvalId);
      if (updErr) console.error("[resolve_approval] executed but failed to mark row 'executed':", updErr.message);
      await recordAudit(admin, projectId, claimed.agent_id, claimed.tool_name, claimed.integration_id, claimed.input ?? {}, "allowed");
      return { id: approvalId, status: "executed", result: result.data };
    } catch (err) {
      // Left at 'approved', not reverted to 'pending' — same reasoning as yogaipilot: re-queuing
      // could double-fire a side effect that partially went through.
      await recordAudit(admin, projectId, claimed.agent_id, claimed.tool_name, claimed.integration_id, claimed.input ?? {}, "error", (err as Error).message);
      throw err;
    }
  },

  async list_audit_logs(args, { admin, projectId }) {
    let q = admin
      .from("audit_logs").select("id, agent_id, tool_name, integration_id, input, status, error_message, created_at")
      .eq("project_id", projectId).order("created_at", { ascending: false }).limit(Number(args.limit ?? 100));
    if (args.tool_name) q = q.eq("tool_name", String(args.tool_name));
    if (args.status) q = q.eq("status", String(args.status));
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  },
};
