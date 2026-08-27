/** Canonical invoices.* / contacts.* tools — dispatch to whichever connector the target
 *  integration_id belongs to. Same posture as products.ts: authorization already happened in
 *  index.ts before a handler here ever runs. */
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
    name: "invoices.search",
    description: "Search invoices on a bookkeeping integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: {
        integration_id: { type: "string" },
        search: { type: "string" },
        status: { type: "string", description: "e.g. open, paid, voided, draft" },
        page: { type: "number" },
      },
    },
  },
  {
    name: "invoices.get",
    description: "Get one invoice by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "invoice_id"],
      properties: { integration_id: { type: "string" }, invoice_id: { type: "string" } },
    },
  },
  {
    name: "contacts.search",
    description: "Search contacts (customers/vendors/leads) on a bookkeeping or CRM integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: { integration_id: { type: "string" }, name: { type: "string" }, email: { type: "string" }, page: { type: "number" } },
    },
  },
  {
    name: "contacts.get",
    description: "Get one contact by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "contact_id"],
      properties: { integration_id: { type: "string" }, contact_id: { type: "string" } },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async "invoices.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("invoices.search", args)).data;
  },

  async "invoices.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("invoices.get", args)).data;
  },

  async "contacts.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("contacts.search", args)).data;
  },

  async "contacts.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("contacts.get", args)).data;
  },
};
