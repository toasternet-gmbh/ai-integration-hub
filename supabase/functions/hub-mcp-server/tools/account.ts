/** Self-service account tools (GDPR data portability + right to erasure) — bootstrap-level like
 *  organizations.ts, since they act on the caller's own account across every org/project they
 *  belong to, not one project_id. Scoped strictly to ctx.userId; there is no "export/delete someone
 *  else's account" here. */
import type { ToolDefinition, ToolModule } from "../lib/types.ts";

export const definitions: ToolDefinition[] = [
  {
    name: "export_my_data",
    description: "Export all personal data this Hub holds about the caller: profile, organization/project memberships, API keys (metadata only), and approvals they requested or decided.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "delete_my_account",
    description:
      "Permanently delete the caller's own account. Refuses if the caller is the sole owner of any project — " +
      "transfer or share ownership there first (Team page) before deleting.",
    inputSchema: { type: "object", properties: {} },
  },
];

export const handlers: ToolModule["handlers"] = {
  async export_my_data(_args, { admin, userId }) {
    if (!userId) throw new Error("export_my_data requires a signed-in user.");

    const { data: authData, error: authErr } = await admin.auth.admin.getUserById(userId);
    if (authErr) throw new Error(authErr.message);

    const [orgMemberships, projectMemberships, apiKeys, approvals] = await Promise.all([
      admin.from("hub_organization_members").select("role, created_at, hub_organizations(id, name, created_at)").eq("user_id", userId),
      admin.from("hub_project_members").select("role, created_at, hub_projects(id, name, organization_id, created_at)").eq("user_id", userId),
      admin.from("hub_api_keys").select("id, project_id, name, last_used_at, created_at").eq("created_by", userId),
      admin.from("hub_action_approvals").select("id, project_id, tool_name, status, requested_by, approved_by, created_at, decided_at").or(`requested_by.eq.${userId},approved_by.eq.${userId}`),
    ]);
    if (orgMemberships.error) throw new Error(orgMemberships.error.message);
    if (projectMemberships.error) throw new Error(projectMemberships.error.message);
    if (apiKeys.error) throw new Error(apiKeys.error.message);
    if (approvals.error) throw new Error(approvals.error.message);

    return {
      exported_at: new Date().toISOString(),
      profile: { id: userId, email: authData?.user?.email ?? null, created_at: authData?.user?.created_at ?? null },
      organization_memberships: orgMemberships.data,
      project_memberships: projectMemberships.data,
      api_keys: apiKeys.data,
      approvals_involved_in: approvals.data,
    };
  },

  async delete_my_account(_args, { admin, userId }) {
    if (!userId) throw new Error("delete_my_account requires a signed-in user.");

    const { data: ownedProjects, error: ownedErr } = await admin
      .from("hub_project_members").select("project_id, hub_projects(name)").eq("user_id", userId).eq("role", "owner");
    if (ownedErr) throw new Error(ownedErr.message);

    const soleOwnerships: string[] = [];
    for (const row of ownedProjects ?? []) {
      const { count, error: countErr } = await admin
        .from("hub_project_members").select("user_id", { count: "exact", head: true })
        .eq("project_id", row.project_id).eq("role", "owner").neq("user_id", userId);
      if (countErr) throw new Error(countErr.message);
      if (!count) soleOwnerships.push((row.hub_projects as { name?: string } | null)?.name ?? row.project_id);
    }
    if (soleOwnerships.length > 0) {
      throw new Error(
        `You are the only owner of: ${soleOwnerships.join(", ")}. Invite a co-owner or delete ${soleOwnerships.length > 1 ? "these projects" : "this project"} first, via the Team page.`,
      );
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
};
