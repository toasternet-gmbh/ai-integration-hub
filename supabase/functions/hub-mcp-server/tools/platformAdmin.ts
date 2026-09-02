/**
 * Platform-admin ("superadmin") tools — sit above org/project membership entirely. Every handler
 * here is bootstrap-level like organizations.ts/account.ts (callable with no project_id: ctx.userId
 * is what matters, ctx.projectId is just ""), and every one of them starts with assertPlatformAdmin,
 * since these bypass every org/project boundary that protects a normal user's data.
 */
import type { SupabaseAdmin, ToolDefinition, ToolModule } from "../lib/types.ts";

async function assertPlatformAdmin(admin: SupabaseAdmin, userId: string | null): Promise<string> {
  if (!userId) throw new Error("This tool requires a signed-in user.");
  const { data, error } = await admin.from("hub_platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Not a platform admin.");
  return userId;
}

async function findUserByEmail(admin: SupabaseAdmin, email: string) {
  const { data: usersPage, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(error.message);
  return (usersPage.users ?? []).find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

export const definitions: ToolDefinition[] = [
  {
    name: "am_i_platform_admin",
    description: "Whether the caller is a Hub platform admin (superadmin) — used to decide whether to show the platform-admin area at all.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "admin_list_organizations",
    description: "[Platform admin] List every organization on the Hub, with its owner's email and project count.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "admin_create_organization",
    description: "[Platform admin] Create a new organization and make an existing user its owner, by email.",
    inputSchema: { type: "object", required: ["name", "owner_email"], properties: { name: { type: "string" }, owner_email: { type: "string" } } },
  },
  {
    name: "admin_rename_organization",
    description: "[Platform admin] Rename an organization.",
    inputSchema: { type: "object", required: ["organization_id", "name"], properties: { organization_id: { type: "string" }, name: { type: "string" } } },
  },
  {
    name: "admin_delete_organization",
    description: "[Platform admin] Permanently delete an organization and every project/integration/agent/audit record beneath it.",
    inputSchema: { type: "object", required: ["organization_id"], properties: { organization_id: { type: "string" } } },
  },
  {
    name: "admin_list_users",
    description: "[Platform admin] List every user account on the Hub.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "admin_create_user",
    description: "[Platform admin] Create a new user account directly (email + password, pre-confirmed). Optionally add them to an existing organization.",
    inputSchema: {
      type: "object", required: ["email", "password"],
      properties: { email: { type: "string" }, password: { type: "string" }, organization_id: { type: "string" }, role: { type: "string", enum: ["owner", "member"] } },
    },
  },
  {
    name: "admin_set_user_banned",
    description: "[Platform admin] Ban or unban a user account (blocks sign-in without deleting their data).",
    inputSchema: { type: "object", required: ["user_id", "banned"], properties: { user_id: { type: "string" }, banned: { type: "boolean" } } },
  },
  {
    name: "admin_delete_user",
    description: "[Platform admin] Permanently delete a user account. Refuses if they are the sole owner of any project.",
    inputSchema: { type: "object", required: ["user_id"], properties: { user_id: { type: "string" } } },
  },
  {
    name: "admin_list_platform_types",
    description: "[Platform admin] List every e-commerce platform type the Hub can connect to (WooCommerce, Shopware, ...), with how many integrations exist Hub-wide and whether it's enabled Hub-wide.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "admin_set_platform_type_enabled",
    description: "[Platform admin] Enable or disable a platform type Hub-wide — disabling blocks new integrations of that platform (existing ones keep working).",
    inputSchema: { type: "object", required: ["name", "enabled"], properties: { name: { type: "string" }, enabled: { type: "boolean" } } },
  },
  {
    name: "admin_set_platform_verification",
    description:
      "[Platform admin] Record how thoroughly a platform's connector has actually been verified — 'unverified' (never confirmed against the real provider API), " +
      "'api_verified' (a real round-trip to the provider's API, not yet a real customer account), or 'real_customer_verified' (exercised end-to-end against a " +
      "real, fully-authorized customer account). Distinct from enabling/disabling the platform — this just records the evidence, it doesn't gate anything.",
    inputSchema: {
      type: "object",
      required: ["name", "verification_status"],
      properties: {
        name: { type: "string" },
        verification_status: { type: "string", enum: ["unverified", "api_verified", "real_customer_verified"] },
        verification_note: { type: "string", description: "Free-text context, e.g. what was tested and against what." },
      },
    },
  },
  {
    name: "admin_list_platforms",
    description: "[Platform admin] List the Hub-wide tool/platform catalog (hub_tool_registry) — every tool an agent could be granted, which e-commerce platforms it supports, and whether it's enabled Hub-wide.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "admin_upsert_platform_tool",
    description: "[Platform admin] Create or update one entry in the Hub-wide tool/platform catalog.",
    inputSchema: {
      type: "object",
      required: ["name", "domain"],
      properties: {
        name: { type: "string" }, domain: { type: "string" }, risk: { type: "string", enum: ["low", "medium", "high"] },
        description: { type: "string" }, supported_platforms: { type: "array", items: { type: "string" } },
        default_policy: { type: "string", enum: ["allow", "deny", "require_approval"] }, enabled: { type: "boolean" },
      },
    },
  },
  {
    name: "admin_get_settings",
    description: "[Platform admin] Get every Hub-wide setting (key/value, not tied to any organization).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "admin_set_setting",
    description: "[Platform admin] Set one Hub-wide setting.",
    inputSchema: { type: "object", required: ["key", "value"], properties: { key: { type: "string" }, value: {} } },
  },
  {
    name: "admin_list_platform_admins",
    description: "[Platform admin] List every current platform admin.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "admin_grant_platform_admin",
    description: "[Platform admin] Grant platform-admin access to a user, by email.",
    inputSchema: { type: "object", required: ["email"], properties: { email: { type: "string" } } },
  },
  {
    name: "admin_revoke_platform_admin",
    description: "[Platform admin] Revoke a user's platform-admin access. Refuses to remove the last remaining admin.",
    inputSchema: { type: "object", required: ["user_id"], properties: { user_id: { type: "string" } } },
  },
];

export const handlers: ToolModule["handlers"] = {
  async am_i_platform_admin(_args, { admin, userId }) {
    if (!userId) return { is_admin: false };
    const { data } = await admin.from("hub_platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
    return { is_admin: !!data };
  },

  async admin_list_organizations(_args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const { data: orgs, error } = await admin.from("hub_organizations").select("id, name, created_at").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return Promise.all((orgs ?? []).map(async (org: { id: string; name: string; created_at: string }) => {
      const [{ data: owner }, { count: projectCount }] = await Promise.all([
        admin.from("hub_organization_members").select("user_id").eq("organization_id", org.id).eq("role", "owner").limit(1).maybeSingle(),
        admin.from("hub_projects").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
      ]);
      let ownerEmail: string | null = null;
      if (owner?.user_id) {
        const { data: authData } = await admin.auth.admin.getUserById(owner.user_id);
        ownerEmail = authData?.user?.email ?? null;
      }
      return { ...org, owner_email: ownerEmail, project_count: projectCount ?? 0 };
    }));
  },

  async admin_create_organization(args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const name = String(args.name ?? "").trim();
    const ownerEmail = String(args.owner_email ?? "").trim();
    if (!name || !ownerEmail) throw new Error("name and owner_email are required.");
    const owner = await findUserByEmail(admin, ownerEmail);
    if (!owner) throw new Error(`No user found with email ${ownerEmail}.`);

    const { data: org, error } = await admin.from("hub_organizations").insert({ name }).select("id, name, created_at").single();
    if (error) throw new Error(error.message);
    const { error: memErr } = await admin.from("hub_organization_members").insert({ user_id: owner.id, organization_id: org.id, role: "owner" });
    if (memErr) throw new Error(memErr.message);
    return { ...org, owner_email: owner.email ?? null, project_count: 0 };
  },

  async admin_rename_organization(args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const organizationId = String(args.organization_id ?? "");
    const name = String(args.name ?? "").trim();
    if (!organizationId || !name) throw new Error("organization_id and name are required.");
    const { data, error } = await admin.from("hub_organizations").update({ name }).eq("id", organizationId).select("id, name, created_at").single();
    if (error) throw new Error(error.message);
    return data;
  },

  async admin_delete_organization(args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const organizationId = String(args.organization_id ?? "");
    if (!organizationId) throw new Error("organization_id is required.");
    const { error } = await admin.from("hub_organizations").delete().eq("id", organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async admin_list_users(_args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    // admin.auth.admin.listUsers() would return every auth.users row on the Supabase project,
    // paginated and unfiltered. Scope to users who belong to at least one hub_organization, plus
    // platform admins (who may have no org membership of their own, e.g. a freshly created admin).
    const [{ data: memberRows, error: memErr }, { data: adminRows, error: adminErr }] = await Promise.all([
      admin.from("hub_organization_members").select("user_id"),
      admin.from("hub_platform_admins").select("user_id"),
    ]);
    if (memErr) throw new Error(memErr.message);
    if (adminErr) throw new Error(adminErr.message);
    const hubUserIds = [...new Set([
      ...(memberRows ?? []).map((r: { user_id: string }) => r.user_id),
      ...(adminRows ?? []).map((r: { user_id: string }) => r.user_id),
    ])];

    return Promise.all(hubUserIds.map(async (id) => {
      const { data: authData, error } = await admin.auth.admin.getUserById(id);
      if (error || !authData?.user) return null;
      const u = authData.user;
      return {
        id: u.id, email: u.email ?? null, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null,
        banned: !!u.banned_until && new Date(u.banned_until).getTime() > Date.now(),
      };
    })).then((rows) => rows.filter(Boolean));
  },

  async admin_create_user(args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const email = String(args.email ?? "").trim();
    const password = String(args.password ?? "");
    if (!email || !password) throw new Error("email and password are required.");
    const organizationId = args.organization_id ? String(args.organization_id) : null;
    const role = args.role === "member" ? "member" : "owner";

    const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(error.message);
    const newUser = created.user;

    if (organizationId) {
      const { error: memErr } = await admin.from("hub_organization_members").insert({ user_id: newUser.id, organization_id: organizationId, role });
      if (memErr) throw new Error(memErr.message);
    }
    return { id: newUser.id, email: newUser.email ?? null, created_at: newUser.created_at, last_sign_in_at: null, banned: false };
  },

  async admin_set_user_banned(args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const targetId = String(args.user_id ?? "");
    if (!targetId) throw new Error("user_id is required.");
    const { error } = await admin.auth.admin.updateUserById(targetId, { ban_duration: args.banned ? "876000h" : "none" });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async admin_delete_user(args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const targetId = String(args.user_id ?? "");
    if (!targetId) throw new Error("user_id is required.");

    const { data: ownedProjects, error: ownedErr } = await admin
      .from("hub_project_members").select("project_id, hub_projects(name)").eq("user_id", targetId).eq("role", "owner");
    if (ownedErr) throw new Error(ownedErr.message);
    const soleOwnerships: string[] = [];
    for (const row of ownedProjects ?? []) {
      const { count, error: countErr } = await admin
        .from("hub_project_members").select("user_id", { count: "exact", head: true })
        .eq("project_id", row.project_id).eq("role", "owner").neq("user_id", targetId);
      if (countErr) throw new Error(countErr.message);
      if (!count) soleOwnerships.push((row.hub_projects as { name?: string } | null)?.name ?? row.project_id);
    }
    if (soleOwnerships.length > 0) {
      throw new Error(`This user is the only owner of: ${soleOwnerships.join(", ")}. Transfer or share ownership there first.`);
    }

    const { error } = await admin.auth.admin.deleteUser(targetId);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async admin_list_platform_types(_args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const [{ data: types, error: typesErr }, { data: integrations, error: intErr }] = await Promise.all([
      admin.from("hub_platform_types").select("name, label, enabled, verification_status, verification_note, created_at").order("name"),
      admin.from("hub_integrations").select("platform, status"),
    ]);
    if (typesErr) throw new Error(typesErr.message);
    if (intErr) throw new Error(intErr.message);

    return (types ?? []).map((platform: { name: string }) => {
      const rows = (integrations ?? []).filter((i: { platform: string }) => i.platform === platform.name);
      return {
        ...platform,
        integrations_total: rows.length,
        integrations_connected: rows.filter((r: { status: string }) => r.status === "connected").length,
        integrations_error: rows.filter((r: { status: string }) => r.status === "error").length,
        integrations_pending: rows.filter((r: { status: string }) => r.status === "pending").length,
      };
    });
  },

  async admin_set_platform_type_enabled(args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const name = String(args.name ?? "").trim();
    if (!name) throw new Error("name is required.");
    const { data, error } = await admin
      .from("hub_platform_types").update({ enabled: !!args.enabled }).eq("name", name).select("name, label, enabled, verification_status, verification_note, created_at").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Unknown platform type '${name}'.`);
    return data;
  },

  async admin_set_platform_verification(args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const name = String(args.name ?? "").trim();
    const verificationStatus = String(args.verification_status ?? "");
    if (!name) throw new Error("name is required.");
    if (!["unverified", "api_verified", "real_customer_verified"].includes(verificationStatus)) {
      throw new Error("verification_status must be one of unverified, api_verified, real_customer_verified.");
    }
    const row: Record<string, unknown> = { verification_status: verificationStatus };
    if (args.verification_note !== undefined) row.verification_note = args.verification_note || null;
    const { data, error } = await admin
      .from("hub_platform_types").update(row).eq("name", name).select("name, label, enabled, verification_status, verification_note, created_at").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Unknown platform type '${name}'.`);
    return data;
  },

  async admin_list_platforms(_args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const { data, error } = await admin.from("hub_tool_registry").select("*").order("name");
    if (error) throw new Error(error.message);
    return data;
  },

  async admin_upsert_platform_tool(args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const name = String(args.name ?? "").trim();
    const domain = String(args.domain ?? "").trim();
    if (!name || !domain) throw new Error("name and domain are required.");
    const row: Record<string, unknown> = { name, domain };
    if (args.risk !== undefined) row.risk = args.risk;
    if (args.description !== undefined) row.description = args.description;
    if (args.supported_platforms !== undefined) row.supported_platforms = args.supported_platforms;
    if (args.default_policy !== undefined) row.default_policy = args.default_policy;
    if (args.enabled !== undefined) row.enabled = args.enabled;
    const { data, error } = await admin.from("hub_tool_registry").upsert(row, { onConflict: "name" }).select("*").single();
    if (error) throw new Error(error.message);
    return data;
  },

  async admin_get_settings(_args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const { data, error } = await admin.from("hub_platform_settings").select("key, value, updated_at").order("key");
    if (error) throw new Error(error.message);
    return data;
  },

  async admin_set_setting(args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const key = String(args.key ?? "").trim();
    if (!key) throw new Error("key is required.");
    const { data, error } = await admin.from("hub_platform_settings").upsert({ key, value: args.value ?? null }, { onConflict: "key" }).select("key, value, updated_at").single();
    if (error) throw new Error(error.message);
    return data;
  },

  async admin_list_platform_admins(_args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const { data, error } = await admin.from("hub_platform_admins").select("user_id, created_at").order("created_at");
    if (error) throw new Error(error.message);
    return Promise.all((data ?? []).map(async (row: { user_id: string; created_at: string }) => {
      const { data: authData } = await admin.auth.admin.getUserById(row.user_id);
      return { user_id: row.user_id, email: authData?.user?.email ?? null, created_at: row.created_at };
    }));
  },

  async admin_grant_platform_admin(args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const email = String(args.email ?? "").trim();
    if (!email) throw new Error("email is required.");
    const target = await findUserByEmail(admin, email);
    if (!target) throw new Error(`No user found with email ${email}.`);
    const { error } = await admin.from("hub_platform_admins").upsert({ user_id: target.id, granted_by: userId }, { onConflict: "user_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true, user_id: target.id, email: target.email };
  },

  async admin_revoke_platform_admin(args, { admin, userId }) {
    await assertPlatformAdmin(admin, userId);
    const targetId = String(args.user_id ?? "");
    if (!targetId) throw new Error("user_id is required.");
    const { count, error: countErr } = await admin.from("hub_platform_admins").select("user_id", { count: "exact", head: true });
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) <= 1) throw new Error("Cannot revoke the last remaining platform admin.");
    const { error } = await admin.from("hub_platform_admins").delete().eq("user_id", targetId);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
};
