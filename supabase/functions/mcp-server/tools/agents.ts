/** Agent CRUD + per-tool permission management (mirrors yogaipilot's agentAdmin.ts shape). */
import type { ToolDefinition, ToolModule } from "../../_shared/types.ts";

export const definitions: ToolDefinition[] = [
  {
    name: "create_agent",
    description: "Register a new AI agent for this project.",
    inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" }, description: { type: "string" } } },
  },
  {
    name: "list_agents",
    description: "List agents registered on this project.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "set_agent_tool_permission",
    description: "Set an agent's permission for a tool: allow / deny / require_approval. Omit integration_id to set the agent's default rule for that tool across all integrations.",
    inputSchema: {
      type: "object",
      required: ["agent_id", "tool_name", "permission"],
      properties: {
        agent_id: { type: "string" }, tool_name: { type: "string" },
        integration_id: { type: "string" }, permission: { type: "string", enum: ["allow", "deny", "require_approval"] },
      },
    },
  },
  {
    name: "list_agent_tool_permissions",
    description: "List an agent's per-tool permission rules.",
    inputSchema: { type: "object", required: ["agent_id"], properties: { agent_id: { type: "string" } } },
  },
];

export const handlers: ToolModule["handlers"] = {
  async create_agent(args, { admin, projectId }) {
    const name = String(args.name ?? "").trim();
    if (!name) throw new Error("name is required.");
    const { data, error } = await admin
      .from("agents").insert({ project_id: projectId, name, description: args.description ? String(args.description) : null })
      .select("id, name, description, status, created_at").single();
    if (error) throw new Error(error.message);
    return data;
  },

  async list_agents(_args, { admin, projectId }) {
    const { data, error } = await admin.from("agents").select("id, name, description, status, created_at").eq("project_id", projectId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  async set_agent_tool_permission(args, { admin, projectId }) {
    const agentId = String(args.agent_id ?? "");
    const toolName = String(args.tool_name ?? "");
    const permission = String(args.permission ?? "");
    const integrationId = args.integration_id ? String(args.integration_id) : null;
    if (!agentId || !toolName || !permission) throw new Error("agent_id, tool_name, and permission are required.");

    let q = admin.from("agent_tool_permissions").select("id").eq("project_id", projectId).eq("agent_id", agentId).eq("tool_name", toolName);
    q = integrationId ? q.eq("integration_id", integrationId) : q.is("integration_id", null);
    const { data: existing, error: lookupErr } = await q.maybeSingle();
    if (lookupErr) throw new Error(lookupErr.message);

    if (existing) {
      const { data, error } = await admin.from("agent_tool_permissions").update({ permission }).eq("id", existing.id).select("id, tool_name, integration_id, permission").single();
      if (error) throw new Error(error.message);
      return data;
    }
    const { data, error } = await admin
      .from("agent_tool_permissions")
      .insert({ project_id: projectId, agent_id: agentId, tool_name: toolName, integration_id: integrationId, permission })
      .select("id, tool_name, integration_id, permission").single();
    if (error) throw new Error(error.message);
    return data;
  },

  async list_agent_tool_permissions(args, { admin, projectId }) {
    const agentId = String(args.agent_id ?? "");
    const { data, error } = await admin
      .from("agent_tool_permissions").select("id, tool_name, integration_id, permission, created_at")
      .eq("project_id", projectId).eq("agent_id", agentId).order("tool_name");
    if (error) throw new Error(error.message);
    return data;
  },
};
