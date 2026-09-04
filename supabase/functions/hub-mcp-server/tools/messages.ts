/** Canonical messages.* tools — dispatch to whichever connector the target integration_id belongs
 *  to. Same posture as crm.ts. */
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
    name: "messages.list_rooms",
    description: "List the chats/rooms the connected user has joined on a messaging integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: { integration_id: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "messages.search",
    description: "Full-text search across message content on a messaging integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "query"],
      properties: { integration_id: { type: "string" }, query: { type: "string" } },
    },
  },
  {
    name: "messages.get",
    description: "Get one message by id from a specific chat/room.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "room_id", "message_id"],
      properties: { integration_id: { type: "string" }, room_id: { type: "string" }, message_id: { type: "string" } },
    },
  },
  {
    name: "messages.send",
    description: "Send a text message to a chat/room as the connected user on a messaging integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "room_id", "body"],
      properties: { integration_id: { type: "string" }, room_id: { type: "string" }, body: { type: "string" } },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async "messages.list_rooms"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("messages.list_rooms", args)).data;
  },

  async "messages.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("messages.search", args)).data;
  },

  async "messages.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("messages.get", args)).data;
  },

  async "messages.send"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("messages.send", args)).data;
  },
};
