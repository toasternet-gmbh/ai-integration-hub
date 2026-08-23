/** Bootstrap tools — the only ones callable without an existing project_id (see mcpAuth.ts: a JWT
 *  caller with no project yet still authenticates, just with an empty ctx.projectId). Everything
 *  else in this Hub assumes a project already exists. */
import type { ToolDefinition, ToolModule } from "../../_shared/types.ts";

export const definitions: ToolDefinition[] = [
  {
    name: "create_organization",
    description: "Create a new organization and make the caller its owner. Use once per company/team.",
    inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" } } },
  },
  {
    name: "list_my_organizations",
    description: "List organizations the caller belongs to.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_project",
    description: "Create a new project inside an organization and make the caller its owner.",
    inputSchema: { type: "object", required: ["organization_id", "name"], properties: { organization_id: { type: "string" }, name: { type: "string" } } },
  },
  {
    name: "list_my_projects",
    description: "List projects the caller belongs to (optionally within one organization).",
    inputSchema: { type: "object", properties: { organization_id: { type: "string" } } },
  },
];

export const handlers: ToolModule["handlers"] = {
  async create_organization(args, { admin, userId }) {
    if (!userId) throw new Error("create_organization requires a signed-in user.");
    const name = String(args.name ?? "").trim();
    if (!name) throw new Error("name is required.");
    const { data: org, error } = await admin.from("organizations").insert({ name }).select("id, name, created_at").single();
    if (error) throw new Error(error.message);
    const { error: memErr } = await admin.from("organization_members").insert({ user_id: userId, organization_id: org.id, role: "owner" });
    if (memErr) throw new Error(memErr.message);
    return org;
  },

  async list_my_organizations(_args, { admin, userId }) {
    if (!userId) throw new Error("list_my_organizations requires a signed-in user.");
    const { data, error } = await admin.from("organization_members").select("role, organizations(id, name, created_at)").eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { role: string; organizations: unknown }) => ({ ...(r.organizations as object), role: r.role }));
  },

  async create_project(args, { admin, userId }) {
    if (!userId) throw new Error("create_project requires a signed-in user.");
    const organizationId = String(args.organization_id ?? "");
    const name = String(args.name ?? "").trim();
    if (!organizationId || !name) throw new Error("organization_id and name are required.");

    const { data: membership, error: memLookupErr } = await admin
      .from("organization_members").select("role").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
    if (memLookupErr) throw new Error(memLookupErr.message);
    if (!membership) throw new Error("Not a member of this organization.");

    const { data: project, error } = await admin.from("projects").insert({ organization_id: organizationId, name }).select("id, organization_id, name, created_at").single();
    if (error) throw new Error(error.message);
    const { error: pmErr } = await admin.from("project_members").insert({ user_id: userId, project_id: project.id, role: "owner" });
    if (pmErr) throw new Error(pmErr.message);
    return project;
  },

  async list_my_projects(args, { admin, userId }) {
    if (!userId) throw new Error("list_my_projects requires a signed-in user.");
    let q = admin.from("project_members").select("role, projects(id, organization_id, name, created_at)").eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    let rows = (data ?? []).map((r: { role: string; projects: unknown }) => ({ ...(r.projects as { organization_id: string }), role: r.role }));
    if (args.organization_id) rows = rows.filter((p: { organization_id: string }) => p.organization_id === String(args.organization_id));
    return rows;
  },
};
