/** Canonical employees.* / absences.* / absence_types.* tools — dispatch to whichever connector the
 *  target integration_id belongs to. Same posture as timeEntries.ts: authorization already
 *  happened in index.ts before a handler here ever runs. Personio-only for now — an HR platform
 *  concept, not something Toggl/Clockify (pure time trackers) have. */
import type { SupabaseAdmin, ToolDefinition, ToolModule } from "../lib/types.ts";
import { loadConnector } from "../lib/connectors/factory.ts";

async function requireIntegration(admin: SupabaseAdmin, projectId: string, integrationId: string) {
  const { data, error } = await admin
    .from("hub_integrations")
    .select("id, platform, credentials_encrypted, status")
    .eq("id", integrationId).eq("project_id", projectId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Integration ${integrationId} not found in this project`);
  if (data.status !== "connected") throw new Error(`Integration ${integrationId} is not connected (status: ${data.status})`);
  return data;
}

export const definitions: ToolDefinition[] = [
  {
    name: "employees.search",
    description: "Search employees on an HR integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: {
        integration_id: { type: "string" },
        search: { type: "string", description: "Matched against name/email." },
        status: { type: "string", description: "ACTIVE or INACTIVE." },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "employees.get",
    description: "Get one employee by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "employee_id"],
      properties: { integration_id: { type: "string" }, employee_id: { type: "string" } },
    },
  },
  {
    name: "absence_types.search",
    description: "List the absence types (e.g. vacation, sick leave) configured on an HR integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: { integration_id: { type: "string" } },
    },
  },
  {
    name: "absences.search",
    description: "Search absence/time-off periods on an HR integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: {
        integration_id: { type: "string" },
        employee_id: { type: "string" },
        start_date: { type: "string", description: "ISO 8601 date" },
        end_date: { type: "string", description: "ISO 8601 date" },
      },
    },
  },
  {
    name: "absences.get",
    description: "Get one absence period by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "absence_id"],
      properties: { integration_id: { type: "string" }, absence_id: { type: "string" } },
    },
  },
  {
    name: "absences.create",
    description: "Request a new absence/time-off period for an employee.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "employee_id", "absence_type_id", "start_date"],
      properties: {
        integration_id: { type: "string" },
        employee_id: { type: "string" },
        absence_type_id: { type: "string" },
        start_date: { type: "string", description: "ISO 8601 datetime." },
        end_date: { type: "string", description: "ISO 8601 datetime. Omit for a single-day absence." },
        comment: { type: "string" },
      },
    },
  },
  {
    name: "absences.update",
    description: "Update an existing absence period.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "absence_id"],
      properties: {
        integration_id: { type: "string" }, absence_id: { type: "string" },
        start_date: { type: "string" }, end_date: { type: "string" }, comment: { type: "string" },
      },
    },
  },
  {
    name: "absences.delete",
    description: "Cancel/delete an existing absence period.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "absence_id"],
      properties: { integration_id: { type: "string" }, absence_id: { type: "string" } },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async "employees.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("employees.search", args)).data;
  },

  async "employees.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("employees.get", args)).data;
  },

  async "absence_types.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("absence_types.search", args)).data;
  },

  async "absences.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("absences.search", args)).data;
  },

  async "absences.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("absences.get", args)).data;
  },

  async "absences.create"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("absences.create", args)).data;
  },

  async "absences.update"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("absences.update", args)).data;
  },

  async "absences.delete"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("absences.delete", args)).data;
  },
};
