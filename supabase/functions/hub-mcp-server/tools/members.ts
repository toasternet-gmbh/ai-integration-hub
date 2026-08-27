/** Team management — invite/list/remove members of the caller's current project (and, implicitly,
 *  its organization). No SMTP is configured for this local stack (GOTRUE_MAILER_AUTOCONFIRM=true,
 *  no RESEND_API_KEY here), so invites don't email themselves: invite_project_member either adds an
 *  existing account straight away, or creates the account via GoTrue's admin "invite" link type and
 *  hands the raw action_link back to the caller to copy/send manually — same tradeoff as
 *  admin-user-mgmt's generate_magic_link action elsewhere in this codebase. */
import type { ToolDefinition, ToolModule } from "../lib/types.ts";

const VALID_ROLES = ["owner", "member"];

// deno-lint-ignore no-explicit-any
async function requireOwner(admin: any, projectId: string, userId: string | null): Promise<void> {
  if (!userId) throw new Error("This action requires a signed-in user.");
  const { data, error } = await admin.from("hub_project_members").select("role").eq("project_id", projectId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== "owner") throw new Error("Only a project owner can manage members.");
}

export const definitions: ToolDefinition[] = [
  {
    name: "list_project_members",
    description: "List members of the current project, with email and role.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "invite_project_member",
    description:
      "Add a teammate to the current project (and its organization) by email. If no account exists yet for " +
      "that email, one is created and an invite link is returned for you to send them manually (no email " +
      "provider is configured in this environment). Owner-only.",
    inputSchema: {
      type: "object",
      required: ["email"],
      properties: { email: { type: "string" }, role: { type: "string", enum: VALID_ROLES } },
    },
  },
  {
    name: "update_project_member_role",
    description: "Change a project member's role. Owner-only; cannot demote the last remaining owner.",
    inputSchema: { type: "object", required: ["user_id", "role"], properties: { user_id: { type: "string" }, role: { type: "string", enum: VALID_ROLES } } },
  },
  {
    name: "remove_project_member",
    description: "Remove a member from the current project. Owner-only; cannot remove the last remaining owner.",
    inputSchema: { type: "object", required: ["user_id"], properties: { user_id: { type: "string" } } },
  },
];

export const handlers: ToolModule["handlers"] = {
  async list_project_members(_args, { admin, projectId }) {
    const { data, error } = await admin.from("hub_project_members").select("user_id, role, created_at").eq("project_id", projectId);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    return await Promise.all(rows.map(async (r: { user_id: string; role: string; created_at: string }) => {
      const { data: authData } = await admin.auth.admin.getUserById(r.user_id);
      return { user_id: r.user_id, email: authData?.user?.email ?? "(unknown)", role: r.role, created_at: r.created_at };
    }));
  },

  async invite_project_member(args, { admin, projectId, userId }) {
    await requireOwner(admin, projectId, userId);
    const email = String(args.email ?? "").toLowerCase().trim();
    if (!email) throw new Error("email is required.");
    const role = VALID_ROLES.includes(String(args.role)) ? String(args.role) : "member";

    const { data: project, error: projErr } = await admin.from("hub_projects").select("organization_id").eq("id", projectId).single();
    if (projErr) throw new Error(projErr.message);

    let targetUserId: string;
    let inviteLink: string | null = null;

    const hubAppUrl = Deno.env.get("HUB_APP_URL") || "http://localhost:3060";
    const { data: invited, error: inviteErr } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: `${hubAppUrl}/app` },
    });
    if (inviteErr) {
      const alreadyExists = inviteErr.message?.toLowerCase().includes("already") || inviteErr.message?.toLowerCase().includes("registered");
      if (!alreadyExists) throw new Error(inviteErr.message);
      const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (listErr) throw new Error(listErr.message);
      const existing = users.find((u: { email?: string }) => u.email?.toLowerCase() === email);
      if (!existing) throw new Error("An account with this email exists but could not be looked up.");
      targetUserId = existing.id;
    } else {
      targetUserId = invited!.user!.id;
      inviteLink = (invited as { properties?: { action_link?: string } })?.properties?.action_link ?? null;
    }

    // Always "member" at the org level here, regardless of the project-level `role` requested —
    // this only needs to ensure org membership exists so the invitee can see the org at all.
    // Org ownership is a separate, more privileged grant (create_organization's creator, or a
    // platform admin via admin_create_organization) and must never be reachable by inviting
    // someone into a project, even one the caller owns — a project owner (which any org member
    // can become via create_project) upserting "owner" here would let them promote an arbitrary
    // account to org owner, escalating past their own org-member role.
    await admin.from("hub_organization_members").upsert(
      { organization_id: project.organization_id, user_id: targetUserId, role: "member" },
      { onConflict: "organization_id,user_id", ignoreDuplicates: true },
    );
    const { error: pmErr } = await admin.from("hub_project_members").upsert(
      { project_id: projectId, user_id: targetUserId, role },
      { onConflict: "project_id,user_id" },
    );
    if (pmErr) throw new Error(pmErr.message);

    return { user_id: targetUserId, email, role, invite_link: inviteLink };
  },

  async update_project_member_role(args, { admin, projectId, userId }) {
    await requireOwner(admin, projectId, userId);
    const targetUserId = String(args.user_id ?? "");
    const role = String(args.role ?? "");
    if (!targetUserId || !VALID_ROLES.includes(role)) throw new Error("user_id and a valid role are required.");

    if (role !== "owner") {
      const { count, error: countErr } = await admin
        .from("hub_project_members").select("user_id", { count: "exact", head: true })
        .eq("project_id", projectId).eq("role", "owner").neq("user_id", targetUserId);
      if (countErr) throw new Error(countErr.message);
      if (!count) throw new Error("Cannot demote the last remaining owner.");
    }

    const { error } = await admin.from("hub_project_members").update({ role }).eq("project_id", projectId).eq("user_id", targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async remove_project_member(args, { admin, projectId, userId }) {
    await requireOwner(admin, projectId, userId);
    const targetUserId = String(args.user_id ?? "");
    if (!targetUserId) throw new Error("user_id is required.");
    if (targetUserId === userId) throw new Error("You cannot remove yourself. Ask another owner to do it.");

    const { count, error: countErr } = await admin
      .from("hub_project_members").select("user_id", { count: "exact", head: true })
      .eq("project_id", projectId).eq("role", "owner").neq("user_id", targetUserId);
    if (countErr) throw new Error(countErr.message);
    if (!count) throw new Error("Cannot remove the last remaining owner.");

    const { error } = await admin.from("hub_project_members").delete().eq("project_id", projectId).eq("user_id", targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
};
