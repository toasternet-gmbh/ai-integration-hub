/** Canonical orders.* tools — dispatch to whichever connector the target integration_id belongs to.
 *  Authorization (ALLOW/DENY/REQUIRE_APPROVAL) already happened in index.ts before a handler here
 *  ever runs; a handler assumes it's authorized, same posture as yogaipilot's tools/*.ts. */
import type { SupabaseAdmin, ToolDefinition, ToolModule } from "../../_shared/types.ts";
import { loadConnector } from "../../_shared/connectors/factory.ts";

async function requireIntegration(admin: SupabaseAdmin, projectId: string, integrationId: string) {
  const { data, error } = await admin
    .from("integrations")
    .select("id, platform, credentials_encrypted, status")
    .eq("id", integrationId).eq("project_id", projectId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Integration ${integrationId} not found in this project`);
  if (data.status !== "connected") throw new Error(`Integration ${integrationId} is not connected (status: ${data.status})`);
  return data;
}

export const definitions: ToolDefinition[] = [
  {
    name: "orders.search",
    description: "Search orders on an integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: { integration_id: { type: "string" }, status: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "orders.get",
    description: "Get one order by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "order_id"],
      properties: { integration_id: { type: "string" }, order_id: { type: "string" } },
    },
  },
  {
    name: "orders.refund",
    description: "Refund an existing order (full or partial).",
    inputSchema: {
      type: "object",
      required: ["integration_id", "order_id"],
      properties: {
        integration_id: { type: "string" }, order_id: { type: "string" },
        amount: { type: "number", description: "Omit for a full refund." }, reason: { type: "string" },
      },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async "orders.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("orders.search", args)).data;
  },

  async "orders.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("orders.get", args)).data;
  },

  async "orders.refund"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("orders.refund", args)).data;
  },
};
