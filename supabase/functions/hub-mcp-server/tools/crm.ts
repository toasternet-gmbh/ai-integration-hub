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
};
