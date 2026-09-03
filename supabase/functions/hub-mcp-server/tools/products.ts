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
  {
    name: "products.create",
    description: "Create a new product on an integration — on an e-commerce platform, a real storefront listing; on a bookkeeping platform, a billable article/item.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "name", "price"],
      properties: {
        integration_id: { type: "string" },
        name: { type: "string" },
        price: { type: "number", description: "Net price." },
        tax_rate: { type: "number", description: "Percentage, e.g. 19. Defaults to 19." },
        sku: { type: "string" },
      },
    },
  },
  {
    name: "products.update",
    description: "Update a product's name, price, tax rate, or SKU (broader than products.update_price).",
    inputSchema: {
      type: "object",
      required: ["integration_id", "product_id"],
      properties: {
        integration_id: { type: "string" },
        product_id: { type: "string" },
        name: { type: "string" },
        price: { type: "number" },
        tax_rate: { type: "number" },
        sku: { type: "string" },
      },
    },
  },
  {
    name: "products.categories.search",
    description: "Search the product categories/collections on an e-commerce integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: { integration_id: { type: "string" }, search: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "products.categories.get",
    description: "Get one product category/collection by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "category_id"],
      properties: { integration_id: { type: "string" }, category_id: { type: "string" } },
    },
  },
  {
    name: "products.variants.search",
    description: "List the variants (e.g. different sizes/colors) of a product. Not needed on Shopify -- products.get already returns variants embedded on the product.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "product_id"],
      properties: { integration_id: { type: "string" }, product_id: { type: "string" } },
    },
  },
  {
    name: "products.images.search",
    description: "List the images on a product.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "product_id"],
      properties: { integration_id: { type: "string" }, product_id: { type: "string" } },
    },
  },
  {
    name: "products.images.create",
    description: "Upload a new image to a product.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "product_id", "file_base64", "file_name"],
      properties: {
        integration_id: { type: "string" },
        product_id: { type: "string" },
        file_base64: { type: "string", description: "Base64-encoded image content." },
        file_name: { type: "string", description: "e.g. photo.jpg" },
        mime_type: { type: "string", description: "e.g. image/jpeg. Defaults to image/jpeg." },
      },
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

  async "products.create"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("products.create", args)).data;
  },

  async "products.update"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("products.update", args)).data;
  },

  async "products.categories.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("products.categories.search", args)).data;
  },

  async "products.categories.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("products.categories.get", args)).data;
  },

  async "products.variants.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("products.variants.search", args)).data;
  },

  async "products.images.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("products.images.search", args)).data;
  },

  async "products.images.create"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("products.images.create", args)).data;
  },
};
