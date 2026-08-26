/** Canonical products.* tools — dispatch to whichever connector the target integration_id belongs
 *  to. Same posture as orders.ts: authorization already happened in index.ts before a handler here
 *  ever runs. */
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
    name: "products.search",
    description: "Search products on an integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: { integration_id: { type: "string" }, search: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "products.get",
    description: "Get one product by id (on Magento, the SKU).",
    inputSchema: {
      type: "object",
      required: ["integration_id", "product_id"],
      properties: { integration_id: { type: "string" }, product_id: { type: "string" } },
    },
  },
  {
    name: "products.update_price",
    description: "Update a product's price.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "product_id", "price"],
      properties: { integration_id: { type: "string" }, product_id: { type: "string" }, price: { type: "number" } },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async "products.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("products.search", args)).data;
  },

  async "products.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("products.get", args)).data;
  },

  async "products.update_price"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("products.update_price", args)).data;
  },
};
