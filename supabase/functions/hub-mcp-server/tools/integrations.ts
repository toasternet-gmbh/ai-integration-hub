/** Integration CRUD + connection testing. `list_integrations`/`get_integration` deliberately never
 *  select credentials_encrypted — RLS can't enforce column-level omission, so this is an
 *  application-layer discipline (blueprint §20: "never expose credentials to Agents/Application"). */
import type { ToolDefinition, ToolModule } from "../lib/types.ts";
import { encryptCredentials } from "../lib/crypto.ts";
import { loadConnector } from "../lib/connectors/factory.ts";

const SAFE_COLUMNS = "id, project_id, platform, name, status, capabilities, last_sync_at, error_status, created_at";

export const definitions: ToolDefinition[] = [
  {
    name: "create_integration",
    description:
      "Connect a new external platform (e.g. WooCommerce). Tests the connection immediately. " +
      "Does NOT cover 'gocardless' — banking connections start with list_bank_institutions / " +
      "start_bank_connection instead, since GoCardless uses a consent-redirect flow with no " +
      "credentials to submit here.",
    inputSchema: {
      type: "object",
      required: ["platform", "name", "credentials"],
      properties: {
        platform: {
          type: "string",
          enum: ["woocommerce", "shopware", "shopify", "magento", "wordpress", "lexoffice", "toggl", "sevdesk", "personio", "datev", "jtl", "typo3", "contentful", "clockify", "prestashop", "hubspot"],
        },
        name: { type: "string" },
        credentials: {
          type: "object",
          description:
            "Platform-specific — woocommerce: {storeUrl, consumerKey, consumerSecret}; " +
            "shopware: {storeUrl, clientId, clientSecret}; shopify: {storeUrl, accessToken}; " +
            "magento: {storeUrl, accessToken}; lexoffice: {apiKey}; " +
            "wordpress: {siteUrl, username, appPassword}; toggl: {apiToken}; sevdesk: {apiKey}; " +
            "personio: {clientId, clientSecret}; datev: {clientId, clientSecret}; " +
            "jtl: {clientId, clientSecret}; typo3: {siteUrl, accessToken}; " +
            "contentful: {spaceId, accessToken, environmentId?, managementToken?} (managementToken enables cms.pages.create); clockify: {workspaceId, apiKey}; " +
            "prestashop: {storeUrl, accessToken (webservice key)}; hubspot: {accessToken (private app token)}.",
        },
      },
    },
  },
  {
    name: "list_integrations",
    description: "List integrations connected to this project (never returns credentials).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "test_integration_connection",
    description: "Re-test an existing integration's connection and update its status.",
    inputSchema: { type: "object", required: ["integration_id"], properties: { integration_id: { type: "string" } } },
  },
  {
    name: "delete_integration",
    description: "Disconnect and permanently remove an integration, including its stored credentials.",
    inputSchema: { type: "object", required: ["integration_id"], properties: { integration_id: { type: "string" } } },
  },
];

export const handlers: ToolModule["handlers"] = {
  async create_integration(args, { admin, projectId }) {
    const platform = String(args.platform ?? "");
    const name = String(args.name ?? "").trim();
    if (!name) throw new Error("name is required.");

    // A platform admin disabling a platform type Hub-wide (superadmin's Platforms page) blocks new
    // integrations of it — same kill-switch pattern as hub_tool_registry.enabled for individual tools.
    const { data: platformType, error: platformErr } = await admin.from("hub_platform_types").select("enabled").eq("name", platform).maybeSingle();
    if (platformErr) throw new Error(platformErr.message);
    if (platformType && !platformType.enabled) throw new Error(`Platform '${platform}' is disabled Hub-wide.`);

    const credentials = (args.credentials ?? {}) as Record<string, unknown>;
    const encrypted = await encryptCredentials(credentials);

    const { data, error } = await admin
      .from("hub_integrations")
      .insert({ project_id: projectId, platform, name, credentials_encrypted: encrypted, status: "pending" })
      .select(SAFE_COLUMNS).single();
    if (error) throw new Error(error.message);

    try {
      const connector = await loadConnector({ platform, credentials_encrypted: encrypted });
      const result = await connector.testConnection();
      const capabilities = result.ok ? await connector.getCapabilities() : [];
      const { data: updated, error: updErr } = await admin
        .from("hub_integrations")
        .update({ status: result.ok ? "connected" : "error", error_status: result.ok ? null : result.message, capabilities })
        .eq("id", data.id).select(SAFE_COLUMNS).single();
      if (updErr) throw new Error(updErr.message);
      return updated;
    } catch (err) {
      const { data: updated } = await admin
        .from("hub_integrations").update({ status: "error", error_status: (err as Error).message }).eq("id", data.id).select(SAFE_COLUMNS).single();
      return updated;
    }
  },

  async list_integrations(_args, { admin, projectId }) {
    const { data, error } = await admin.from("hub_integrations").select(SAFE_COLUMNS).eq("project_id", projectId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  async delete_integration(args, { admin, projectId }) {
    const integrationId = String(args.integration_id ?? "");
    if (!integrationId) throw new Error("integration_id is required.");
    const { error, count } = await admin
      .from("hub_integrations").delete({ count: "exact" }).eq("id", integrationId).eq("project_id", projectId);
    if (error) throw new Error(error.message);
    if (!count) throw new Error("Integration not found.");
    return { ok: true };
  },

  async test_integration_connection(args, { admin, projectId }) {
    const integrationId = String(args.integration_id ?? "");
    const { data: integration, error } = await admin
      .from("hub_integrations").select("id, platform, credentials_encrypted").eq("id", integrationId).eq("project_id", projectId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!integration) throw new Error("Integration not found.");

    const connector = await loadConnector(integration);
    const result = await connector.testConnection();
    const { data: updated, error: updErr } = await admin
      .from("hub_integrations")
      .update({ status: result.ok ? "connected" : "error", error_status: result.ok ? null : result.message })
      .eq("id", integrationId).select(SAFE_COLUMNS).single();
    if (updErr) throw new Error(updErr.message);
    return updated;
  },
};
