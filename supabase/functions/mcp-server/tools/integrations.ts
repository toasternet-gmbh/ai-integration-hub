/** Integration CRUD + connection testing. `list_integrations`/`get_integration` deliberately never
 *  select credentials_encrypted — RLS can't enforce column-level omission, so this is an
 *  application-layer discipline (blueprint §20: "never expose credentials to Agents/Application"). */
import type { ToolDefinition, ToolModule } from "../../_shared/types.ts";
import { encryptCredentials } from "../../_shared/crypto.ts";
import { loadConnector } from "../../_shared/connectors/factory.ts";

const SAFE_COLUMNS = "id, project_id, platform, name, status, capabilities, last_sync_at, error_status, created_at";

export const definitions: ToolDefinition[] = [
  {
    name: "create_integration",
    description: "Connect a new external platform (e.g. WooCommerce). Tests the connection immediately.",
    inputSchema: {
      type: "object",
      required: ["platform", "name", "credentials"],
      properties: {
        platform: { type: "string", enum: ["woocommerce", "shopify", "wordpress"] },
        name: { type: "string" },
        credentials: { type: "object", description: "Platform-specific — for woocommerce: {storeUrl, consumerKey, consumerSecret}." },
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
];

export const handlers: ToolModule["handlers"] = {
  async create_integration(args, { admin, projectId }) {
    const platform = String(args.platform ?? "");
    const name = String(args.name ?? "").trim();
    if (!name) throw new Error("name is required.");
    const credentials = (args.credentials ?? {}) as Record<string, unknown>;
    const encrypted = await encryptCredentials(credentials);

    const { data, error } = await admin
      .from("integrations")
      .insert({ project_id: projectId, platform, name, credentials_encrypted: encrypted, status: "pending" })
      .select(SAFE_COLUMNS).single();
    if (error) throw new Error(error.message);

    try {
      const connector = await loadConnector({ platform, credentials_encrypted: encrypted });
      const result = await connector.testConnection();
      const capabilities = result.ok ? await connector.getCapabilities() : [];
      const { data: updated, error: updErr } = await admin
        .from("integrations")
        .update({ status: result.ok ? "connected" : "error", error_status: result.ok ? null : result.message, capabilities })
        .eq("id", data.id).select(SAFE_COLUMNS).single();
      if (updErr) throw new Error(updErr.message);
      return updated;
    } catch (err) {
      const { data: updated } = await admin
        .from("integrations").update({ status: "error", error_status: (err as Error).message }).eq("id", data.id).select(SAFE_COLUMNS).single();
      return updated;
    }
  },

  async list_integrations(_args, { admin, projectId }) {
    const { data, error } = await admin.from("integrations").select(SAFE_COLUMNS).eq("project_id", projectId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  async test_integration_connection(args, { admin, projectId }) {
    const integrationId = String(args.integration_id ?? "");
    const { data: integration, error } = await admin
      .from("integrations").select("id, platform, credentials_encrypted").eq("id", integrationId).eq("project_id", projectId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!integration) throw new Error("Integration not found.");

    const connector = await loadConnector(integration);
    const result = await connector.testConnection();
    const { data: updated, error: updErr } = await admin
      .from("integrations")
      .update({ status: result.ok ? "connected" : "error", error_status: result.ok ? null : result.message })
      .eq("id", integrationId).select(SAFE_COLUMNS).single();
    if (updErr) throw new Error(updErr.message);
    return updated;
  },
};
