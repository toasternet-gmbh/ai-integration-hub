/** Generic OAuth2 consent-redirect flow for outlook/google — the productivity-domain analog of
 *  tools/banking.ts's start_bank_connection/complete_bank_connection, generalized across
 *  providers instead of hardcoded to one (GoCardless). `start_oauth_connection` creates a pending
 *  integration and hands back the provider's own authorize_url, using the integration's own id as
 *  the OAuth `state` parameter (same "reuse the row id, no separate lookup table" trick GoCardless
 *  uses for its requisition `reference`). The frontend redirects the user there; the provider
 *  redirects back to the Hub with `?state=<integration_id>&code=<code>`, and the frontend calls
 *  `complete_oauth_connection` with those to finalize.
 *
 *  `state` being just the row id is NOT by itself CSRF-safe — project ownership alone doesn't
 *  prove the completing request came from whoever actually started this specific flow. To close
 *  that, `start_oauth_connection` stashes the initiating caller's `userId` in the row's pending
 *  credentials, and `complete_oauth_connection` requires the same `userId` to complete it —
 *  otherwise another project member's (or an attacker's, if they can get a victim who IS a
 *  project member to open a crafted callback URL carrying the attacker's own authorization code)
 *  request can't bind unrelated third-party tokens onto this integration. */
import type { SupabaseAdmin, ToolDefinition, ToolModule } from "../lib/types.ts";
import { encryptCredentials, decryptCredentials } from "../lib/crypto.ts";
import { loadConnector } from "../lib/connectors/factory.ts";
import { assertOAuth2Configured, buildAuthorizeUrl, exchangeCode, isOAuth2Platform, OAUTH2_PLATFORMS } from "../lib/oauth2.ts";

const SAFE_COLUMNS = "id, project_id, platform, name, status, capabilities, last_sync_at, error_status, created_at";

async function findIntegration(admin: SupabaseAdmin, projectId: string, integrationId: string) {
  const { data, error } = await admin
    .from("hub_integrations")
    .select("id, project_id, platform, credentials_encrypted, status")
    .eq("id", integrationId).eq("project_id", projectId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Integration ${integrationId} not found in this project`);
  return data;
}

/** Writes the terminal "error" status without ever silently discarding a failure — if this
 *  write itself fails, both messages are combined into the thrown error instead of returning
 *  `undefined` (which would otherwise crash the frontend's `.then` reading `.status` off it,
 *  masking the real cause behind a generic TypeError). */
async function markError(admin: SupabaseAdmin, integrationId: string, originalErr: unknown) {
  const originalMessage = originalErr instanceof Error ? originalErr.message : String(originalErr);
  const { data: updated, error: updErr } = await admin
    .from("hub_integrations").update({ status: "error", error_status: originalMessage }).eq("id", integrationId).select(SAFE_COLUMNS).single();
  if (updErr) throw new Error(`${originalMessage} (additionally failed to record this as the integration's error status: ${updErr.message})`);
  return updated;
}

export const definitions: ToolDefinition[] = [
  {
    name: "start_oauth_connection",
    description: "Begin connecting an OAuth2 consent-redirect platform (outlook, google). Returns an authorize_url to send the user to for consent.",
    inputSchema: {
      type: "object",
      required: ["platform", "name", "redirect_url"],
      properties: {
        platform: { type: "string", enum: [...OAUTH2_PLATFORMS] },
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
  async start_oauth_connection(args, { admin, projectId, userId }) {
    const platform = String(args.platform ?? "");
    if (!isOAuth2Platform(platform)) throw new Error(`start_oauth_connection does not support platform '${platform}'.`);
    const name = String(args.name ?? "").trim();
    const redirectUrl = String(args.redirect_url ?? "");
    if (!name || !redirectUrl) throw new Error("name and redirect_url are required.");

    const { data: platformType, error: platformErr } = await admin.from("hub_platform_types").select("enabled").eq("name", platform).maybeSingle();
    if (platformErr) throw new Error(platformErr.message);
    if (platformType && !platformType.enabled) throw new Error(`Platform '${platform}' is disabled Hub-wide.`);

    // Checked before the insert below, not after: buildAuthorizeUrl() needs the row's own id as
    // `state`, so it can only run once the row exists — but if the Hub-wide app registration isn't
    // configured, failing only after the insert would leave an orphaned "pending" row behind
    // forever with no error_status (confirmed live 2026-09-04, see assertOAuth2Configured's doc).
    assertOAuth2Configured(platform);

    // pendingUserId binds this specific pending flow to whoever started it — complete_oauth_
    // connection requires a match, so a completion request carrying someone else's authorization
    // code can't attach unrelated third-party tokens onto this integration (state alone, being
    // just this row's id, proves project ownership but not "same flow, same initiator").
    const { data: row, error } = await admin
      .from("hub_integrations")
      .insert({ project_id: projectId, platform, name, credentials_encrypted: await encryptCredentials({ pendingUserId: userId }), status: "pending" })
      .select("id").single();
    if (error) throw new Error(error.message);

    const authorizeUrl = buildAuthorizeUrl(platform, row.id, redirectUrl);
    return { integration_id: row.id, authorize_url: authorizeUrl };
  },

  async complete_oauth_connection(args, { admin, projectId, userId }) {
    const integrationId = String(args.integration_id ?? "");
    const code = String(args.code ?? "");
    const redirectUrl = String(args.redirect_url ?? "");
    if (!code || !redirectUrl) throw new Error("code and redirect_url are required.");
    const integration = await findIntegration(admin, projectId, integrationId);

    // Idempotent: a reload/back-navigation/StrictMode double-invoke replaying the same
    // (already-consumed, single-use) code must not downgrade an integration that a prior call
    // already finished connecting successfully — mirrors complete_bank_connection's "safe to call
    // again" guarantee for the GoCardless flow.
    if (integration.status === "connected") return integration;

    const pending = (await decryptCredentials(integration.credentials_encrypted)) as { pendingUserId?: string | null };
    if (pending.pendingUserId !== userId) {
      throw new Error("This connection request doesn't match the session that started it.");
    }

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
      return await markError(admin, integrationId, err);
    }
  },
};
