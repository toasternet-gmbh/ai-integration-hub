/** Generic OAuth2 consent-redirect flow for outlook/google — the productivity-domain analog of
 *  tools/banking.ts's start_bank_connection/complete_bank_connection, generalized across
 *  providers instead of hardcoded to one (GoCardless). `start_oauth_connection` creates a pending
 *  integration and hands back the provider's own authorize_url, using the integration's own id as
 *  the OAuth `state` parameter (same "reuse the row id, no separate lookup table" trick GoCardless
 *  uses for its requisition `reference`). The frontend redirects the user there; the provider
 *  redirects back to the Hub with `?state=<integration_id>&code=<code>`, and the frontend calls
 *  `complete_oauth_connection` with those to finalize. */
import type { SupabaseAdmin, ToolDefinition, ToolModule } from "../lib/types.ts";
import { encryptCredentials } from "../lib/crypto.ts";
import { loadConnector } from "../lib/connectors/factory.ts";
import { buildAuthorizeUrl, exchangeCode } from "../lib/oauth2.ts";

const SAFE_COLUMNS = "id, project_id, platform, name, status, capabilities, last_sync_at, error_status, created_at";
const OAUTH2_PLATFORMS = new Set(["outlook", "google"]);

async function findIntegration(admin: SupabaseAdmin, projectId: string, integrationId: string) {
  const { data, error } = await admin
    .from("hub_integrations")
    .select("id, project_id, platform, credentials_encrypted, status")
    .eq("id", integrationId).eq("project_id", projectId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Integration ${integrationId} not found in this project`);
  return data;
}

export const definitions: ToolDefinition[] = [
  {
    name: "start_oauth_connection",
    description: "Begin connecting an OAuth2 consent-redirect platform (outlook, google). Returns an authorize_url to send the user to for consent.",
    inputSchema: {
      type: "object",
      required: ["platform", "name", "redirect_url"],
      properties: {
        platform: { type: "string", enum: ["outlook", "google"] },
        name: { type: "string" },
        redirect_url: { type: "string", description: "Must exactly match a redirect URI registered with the provider." },
      },
    },
  },
  {
    name: "complete_oauth_connection",
    description: "Finalize an OAuth2 connection after the user returns from the provider's consent page.",
    inputSchema: {
      type: "object",
      required: ["integration_id", "code", "redirect_url"],
      properties: {
        integration_id: { type: "string", description: "The `state` value the provider redirected back with." },
        code: { type: "string" },
        redirect_url: { type: "string", description: "Must be the exact same redirect_url passed to start_oauth_connection." },
      },
    },
  },
];

export const handlers: ToolModule["handlers"] = {
  async start_oauth_connection(args, { admin, projectId }) {
    const platform = String(args.platform ?? "");
    if (!OAUTH2_PLATFORMS.has(platform)) throw new Error(`start_oauth_connection does not support platform '${platform}'.`);
    const name = String(args.name ?? "").trim();
    const redirectUrl = String(args.redirect_url ?? "");
    if (!name || !redirectUrl) throw new Error("name and redirect_url are required.");

    const { data: platformType, error: platformErr } = await admin.from("hub_platform_types").select("enabled").eq("name", platform).maybeSingle();
    if (platformErr) throw new Error(platformErr.message);
    if (platformType && !platformType.enabled) throw new Error(`Platform '${platform}' is disabled Hub-wide.`);

    const { data: row, error } = await admin
      .from("hub_integrations")
      .insert({ project_id: projectId, platform, name, credentials_encrypted: await encryptCredentials({}), status: "pending" })
      .select("id").single();
    if (error) throw new Error(error.message);

    const authorizeUrl = buildAuthorizeUrl(platform, row.id, redirectUrl);
    return { integration_id: row.id, authorize_url: authorizeUrl };
  },

  async complete_oauth_connection(args, { admin, projectId }) {
    const integrationId = String(args.integration_id ?? "");
    const code = String(args.code ?? "");
    const redirectUrl = String(args.redirect_url ?? "");
    if (!code || !redirectUrl) throw new Error("code and redirect_url are required.");
    const integration = await findIntegration(admin, projectId, integrationId);

    try {
      const tokens = await exchangeCode(integration.platform, code, redirectUrl);
      const encrypted = await encryptCredentials({ ...tokens });
      const connector = await loadConnector({ platform: integration.platform, credentials_encrypted: encrypted });
      const capabilities = await connector.getCapabilities();
      const { data: updated, error: updErr } = await admin
        .from("hub_integrations")
        .update({ credentials_encrypted: encrypted, status: "connected", error_status: null, capabilities })
        .eq("id", integrationId).select(SAFE_COLUMNS).single();
      if (updErr) throw new Error(updErr.message);
      return updated;
    } catch (err) {
      const { data: updated } = await admin
        .from("hub_integrations").update({ status: "error", error_status: (err as Error).message }).eq("id", integrationId).select(SAFE_COLUMNS).single();
      return updated;
    }
  },
};
