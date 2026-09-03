/** Canonical deals.* tools — dispatch to whichever connector the target integration_id belongs
 *  to. Same posture as cms.ts. contacts.search/contacts.get are already generic in
 *  bookkeeping.ts (they just dispatch to the integration's connector, not bookkeeping-specific in
 *  code) so a CRM platform implements those there instead of redefining them here. */
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
    name: "deals.search",
    description: "Search deals/opportunities on a CRM integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: { integration_id: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "deals.get",
    description: "Get one deal by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "deal_id"],
      properties: { integration_id: { type: "string" }, deal_id: { type: "string" } },
    },
  },
  {
    name: "deals.create",
    description: "Create a new deal/opportunity on a CRM integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "name"],
      properties: {
        integration_id: { type: "string" },
        name: { type: "string" },
        amount: { type: "number" },
        stage: { type: "string", description: "Omit to use the CRM's default pipeline's first stage." },
      },
    },
  },
  {
    name: "companies.search",
    description: "Search companies/organizations on a CRM integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: { integration_id: { type: "string" }, name: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "companies.get",
    description: "Get one company by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "company_id"],
      properties: { integration_id: { type: "string" }, company_id: { type: "string" } },
    },
  },
  {
    name: "associations.list",
    description: "List the records of one object type associated with a CRM record (e.g. the deals linked to a contact).",
    inputSchema: {
      type: "object",
      required: ["integration_id", "object_type", "object_id", "to_object_type"],
      properties: {
        integration_id: { type: "string" },
        object_type: { type: "string", description: "e.g. contacts, companies, deals" },
        object_id: { type: "string" },
        to_object_type: { type: "string", description: "e.g. contacts, companies, deals" },
      },
    },
  },
  {
    name: "associations.create",
    description: "Link two CRM records together (e.g. attach a contact to a deal).",
    inputSchema: {
      type: "object",
      required: ["integration_id", "object_type", "object_id", "to_object_type", "to_object_id"],
      properties: {
        integration_id: { type: "string" },
        object_type: { type: "string", description: "e.g. contacts, companies, deals" },
        object_id: { type: "string" },
        to_object_type: { type: "string", description: "e.g. contacts, companies, deals" },
        to_object_id: { type: "string" },
      },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async "deals.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("deals.search", args)).data;
  },

  async "deals.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("deals.get", args)).data;
  },

  async "deals.create"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("deals.create", args)).data;
  },

  async "companies.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("companies.search", args)).data;
  },

  async "companies.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("companies.get", args)).data;
  },

  async "associations.list"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("associations.list", args)).data;
  },

  async "associations.create"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("associations.create", args)).data;
  },
};
