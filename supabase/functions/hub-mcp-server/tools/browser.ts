/** Canonical browser.* tools — dispatch to whichever connector the target integration_id belongs
 *  to. Same posture as crm.ts. Unlike every other domain, these tools take an arbitrary `url`
 *  argument the caller controls — the connector itself (lib/connectors/browserless.ts) is what
 *  runs that url through assertPublicHttpUrl before ever fetching it; this file doesn't duplicate
 *  that check; it must stay in the connector so a future second automation platform (e.g.
 *  Steel.dev) can't accidentally skip it. */
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
    name: "browser.get_content",
    description: "Fetch the fully rendered HTML (including JS-rendered content) of a URL via a hosted headless browser.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "url"],
      properties: { integration_id: { type: "string" }, url: { type: "string" } },
    },
  },
  {
    name: "browser.screenshot",
    description: "Take a screenshot of a URL via a hosted headless browser. Returns a base64-encoded PNG.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "url"],
      properties: { integration_id: { type: "string" }, url: { type: "string" }, full_page: { type: "boolean" } },
    },
  },
  {
    name: "browser.scrape",
    description: "Extract structured data from a URL by CSS selector via a hosted headless browser.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "url", "selectors"],
      properties: {
        integration_id: { type: "string" },
        url: { type: "string" },
        selectors: { type: "array", items: { type: "string" }, description: "CSS selectors to extract." },
      },
    },
  },
  {
    name: "browser.pdf",
    description: "Render a URL to PDF via a hosted headless browser. Returns a base64-encoded PDF.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "url"],
      properties: { integration_id: { type: "string" }, url: { type: "string" } },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async "browser.get_content"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("browser.get_content", args)).data;
  },

  async "browser.screenshot"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("browser.screenshot", args)).data;
  },

  async "browser.scrape"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("browser.scrape", args)).data;
  },

  async "browser.pdf"(args, { admin, projectId }) {
    const integration = await requireIntegration(admin, projectId, String(args.integration_id ?? ""));
    const connector = await loadConnector(integration);
    return (await connector.execute("browser.pdf", args)).data;
  },
};
