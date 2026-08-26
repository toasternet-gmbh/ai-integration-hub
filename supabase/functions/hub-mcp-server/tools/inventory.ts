/** Canonical inventory.* tools — dispatch to whichever connector the target integration_id belongs
 *  to. Same posture as orders.ts/products.ts: authorization already happened in index.ts before a
 *  handler here ever runs. Kept as its own domain (not folded into products.*) because on at least
 *  one platform (Shopify) stock genuinely lives behind a separate API, keyed by location. */
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
    name: "inventory.get_stock",
    description: "Get a product's current stock level.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "product_id"],
      properties: { integration_id: { type: "string" }, product_id: { type: "string" } },
    },
  },
  {
    name: "inventory.update_stock",
    description: "Set a product's stock quantity to an exact value (not a delta).",
    inputSchema: {
      type: "object",
      required: ["integration_id", "product_id", "quantity"],
      properties: { integration_id: { type: "string" }, product_id: { type: "string" }, quantity: { type: "number" } },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async "inventory.get_stock"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("inventory.get_stock", args)).data;
  },

  async "inventory.update_stock"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("inventory.update_stock", args)).data;
  },
};
