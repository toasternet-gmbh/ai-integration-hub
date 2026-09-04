/**
 * Like factory.ts's loadConnector, but for real OAuth2 platforms whose access token actually
 * expires (outlook/google) — checks the stored `expiresAt`, refreshes via the stored
 * `refreshToken` if it's within 60s of expiring, persists the new token pair back to
 * `hub_integrations`, and only then constructs the connector. GoCardless doesn't need this: its
 * stored credentials (`requisitionId`/`accountIds`) don't expire the way a real OAuth2 access
 * token does, so it stays on the plain loadConnector path.
 *
 * This is the one piece of logic that doesn't exist anywhere else in this codebase — every other
 * connector's credentials are either a long-lived API key or (for GoCardless) a consent
 * reference, never a short-lived token that needs refreshing on the Hub's own initiative.
 */
import type { Connector } from "./types.ts";
import type { SupabaseAdmin } from "../types.ts";
import { decryptCredentials, encryptCredentials } from "../crypto.ts";
import { refreshTokens } from "../oauth2.ts";
import { loadConnector } from "./factory.ts";

const REFRESHABLE_PLATFORMS = new Set<string>(["outlook", "google"]);

export async function loadConnectorWithRefresh(
  admin: SupabaseAdmin,
  integration: { id: string; platform: string; credentials_encrypted: string },
): Promise<Connector> {
  if (!REFRESHABLE_PLATFORMS.has(integration.platform)) return loadConnector(integration);

  const creds = (await decryptCredentials(integration.credentials_encrypted)) as { accessToken: string; refreshToken: string; expiresAt: number };
  if (creds.expiresAt > Date.now() + 60_000) return loadConnector(integration);

  const refreshed = await refreshTokens(integration.platform, creds.refreshToken);
  const encrypted = await encryptCredentials({ ...refreshed });
  const { error } = await admin.from("hub_integrations").update({ credentials_encrypted: encrypted }).eq("id", integration.id);
  if (error) throw new Error(error.message);
  return loadConnector({ platform: integration.platform, credentials_encrypted: encrypted });
}
