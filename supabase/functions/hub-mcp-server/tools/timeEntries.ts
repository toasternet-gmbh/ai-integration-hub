/** Canonical time_entries.* tools — dispatch to whichever connector the target integration_id
 *  belongs to. Same posture as cms.ts: authorization already happened in index.ts before a
 *  handler here ever runs. */
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
    name: "time_entries.search",
    description: "List time entries on a time-tracking integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: {
        integration_id: { type: "string" },
        start_date: { type: "string", description: "ISO 8601 date" },
        end_date: { type: "string", description: "ISO 8601 date" },
      },
    },
  },
  {
    name: "time_entries.get",
    description: "Get one time entry by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "time_entry_id"],
      properties: { integration_id: { type: "string" }, time_entry_id: { type: "string" } },
    },
  },
  {
    name: "time_entries.create",
    description: "Log a new time entry. Omit end_time to start a running timer (Toggl/Clockify only — Personio has no running-timer concept and requires an end_time).",
    inputSchema: {
      type: "object",
      required: ["integration_id", "start_time"],
      properties: {
        integration_id: { type: "string" },
        description: { type: "string" },
        start_time: { type: "string", description: "ISO 8601 datetime." },
        end_time: { type: "string", description: "ISO 8601 datetime. Omit to start a running timer." },
        project_id: { type: "string", description: "Toggl/Clockify only." },
        employee_id: { type: "string", description: "Personio only — required there, since attendance is logged per employee, not per API token." },
      },
    },
  },
  {
    name: "time_entries.update",
    description: "Update an existing time entry.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "time_entry_id"],
      properties: {
        integration_id: { type: "string" }, time_entry_id: { type: "string" },
        description: { type: "string" }, start_time: { type: "string" }, end_time: { type: "string" }, project_id: { type: "string" },
      },
    },
  },
  {
    name: "time_entries.delete",
    description: "Delete an existing time entry.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "time_entry_id"],
      properties: { integration_id: { type: "string" }, time_entry_id: { type: "string" } },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async "time_entries.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("time_entries.search", args)).data;
  },

  async "time_entries.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("time_entries.get", args)).data;
  },

  async "time_entries.create"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("time_entries.create", args)).data;
  },

  async "time_entries.update"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("time_entries.update", args)).data;
  },

  async "time_entries.delete"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("time_entries.delete", args)).data;
  },
};
