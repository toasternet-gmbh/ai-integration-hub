/** Canonical calendar.* / mail.* tools — dispatch to whichever connector the target integration_id
 *  belongs to. Same posture as crm.ts, except these use loadConnectorWithRefresh instead of the
 *  plain loadConnector: outlook/google credentials are real OAuth2 access tokens that expire, and
 *  need a refresh-and-persist step before use — see lib/connectors/oauthRefresh.ts. */
import type { SupabaseAdmin, ToolDefinition, ToolModule } from "../lib/types.ts";
import { loadConnectorWithRefresh } from "../lib/connectors/oauthRefresh.ts";

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
    name: "calendar.list_events",
    description: "List upcoming (or date-ranged) calendar events on a productivity integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: {
        integration_id: { type: "string" },
        start_date: { type: "string", description: "ISO 8601 datetime." },
        end_date: { type: "string", description: "ISO 8601 datetime." },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "calendar.search",
    description: "Search calendar events by text on a productivity integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "query"],
      properties: { integration_id: { type: "string" }, query: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "calendar.create_event",
    description: "Create a new calendar event on a productivity integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "subject", "start_time", "end_time"],
      properties: {
        integration_id: { type: "string" },
        subject: { type: "string" },
        start_time: { type: "string", description: "ISO 8601 datetime." },
        end_time: { type: "string", description: "ISO 8601 datetime." },
        description: { type: "string" },
        attendees: { type: "array", items: { type: "string" }, description: "Email addresses to invite." },
      },
    },
  },
  {
    name: "mail.search",
    description: "Search email messages by text on a productivity integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "query"],
      properties: { integration_id: { type: "string" }, query: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "mail.get",
    description: "Get one email message by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "message_id"],
      properties: { integration_id: { type: "string" }, message_id: { type: "string" } },
    },
  },
  {
    name: "mail.send",
    description: "Send an email as the connected user on a productivity integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "to", "subject", "body"],
      properties: {
        integration_id: { type: "string" },
        to: { type: "array", items: { type: "string" }, description: "Recipient email addresses." },
        subject: { type: "string" },
        body: { type: "string" },
      },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async "calendar.list_events"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnectorWithRefresh(admin, integration);
    return (await connector.execute("calendar.list_events", args)).data;
  },

  async "calendar.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnectorWithRefresh(admin, integration);
    return (await connector.execute("calendar.search", args)).data;
  },

  async "calendar.create_event"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnectorWithRefresh(admin, integration);
    return (await connector.execute("calendar.create_event", args)).data;
  },

  async "mail.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnectorWithRefresh(admin, integration);
    return (await connector.execute("mail.search", args)).data;
  },

  async "mail.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnectorWithRefresh(admin, integration);
    return (await connector.execute("mail.get", args)).data;
  },

  async "mail.send"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnectorWithRefresh(admin, integration);
    return (await connector.execute("mail.send", args)).data;
  },
};
