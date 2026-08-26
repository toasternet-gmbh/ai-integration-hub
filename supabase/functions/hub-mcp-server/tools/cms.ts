/** Canonical cms.pages.* tools — dispatch to whichever connector the target integration_id
 *  belongs to. Same posture as bookkeeping.ts: authorization already happened in index.ts before
 *  a handler here ever runs. */
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
    name: "cms.pages.search",
    description: "Search pages on a CMS integration.",
    inputSchema: {
      type: "object",
      required: ["integration_id"],
      properties: {
        integration_id: { type: "string" },
        search: { type: "string" },
        status: { type: "string", description: "e.g. publish, draft, private" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "cms.pages.get",
    description: "Get one page by id.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "page_id"],
      properties: { integration_id: { type: "string" }, page_id: { type: "string" } },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async "cms.pages.search"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.pages.search", args)).data;
  },

  async "cms.pages.get"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("cms.pages.get", args)).data;
  },
};
