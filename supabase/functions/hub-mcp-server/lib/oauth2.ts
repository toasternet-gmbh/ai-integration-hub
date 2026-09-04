/**
 * Generic OAuth2 authorization-code consent-redirect helper for platforms that need a real user
 * consent flow (unlike GoCardless's bespoke bank-requisition flow in lib/gocardless.ts, which
 * isn't a generic OAuth2 client at all). Used by tools/oauthConnections.ts's
 * start_oauth_connection/complete_oauth_connection, and by lib/connectors/oauthRefresh.ts to mint
 * a fresh access token from a stored refresh token before a call.
 *
 * Provider client id/secret are Hub-wide app registrations (one Microsoft Entra ID app, one
 * Google Cloud OAuth client), shared across every project — same posture as
 * GOCARDLESS_SECRET_ID/SECRET_KEY. Each project's own integration still gets its own
 * access/refresh token pair from the user who connected it.
 */

export type OAuth2Platform = "outlook" | "google";

/** Single source of truth for "which platforms go through this generic OAuth2 consent-redirect
 *  flow" — tools/oauthConnections.ts and lib/connectors/oauthRefresh.ts both derive their
 *  platform checks from this instead of maintaining their own separate hardcoded lists, so the
 *  three can't drift out of sync (previously outlook/google were listed independently in three
 *  places plus the frontend). Does NOT include 'gocardless', which is also `auth_type: 'oauth2'`
 *  in hub_platform_types but uses its own bespoke, non-refreshing bank-requisition flow instead
 *  of this one — see lib/gocardless.ts. */
export const OAUTH2_PLATFORMS: readonly OAuth2Platform[] = ["outlook", "google"];

export function isOAuth2Platform(platform: string): platform is OAuth2Platform {
  return (OAUTH2_PLATFORMS as readonly string[]).includes(platform);
}

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  extraAuthorizeParams?: Record<string, string>;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured Hub-wide — set it in the edge function's environment before connecting this platform.`);
  return value;
}

function getProviderConfig(platform: string): ProviderConfig {
  switch (platform) {
    // Microsoft Graph (learn.microsoft.com/en-us/graph/auth-v2-user). 'common' allows both work
    // and personal accounts; set MICROSOFT_TENANT_ID to restrict to one Entra ID tenant.
    case "outlook": {
      const tenant = Deno.env.get("MICROSOFT_TENANT_ID") ?? "common";
      return {
        authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
        scope: "offline_access Mail.Read Mail.Send Calendars.ReadWrite",
        clientId: requireEnv("MICROSOFT_CLIENT_ID"),
        clientSecret: requireEnv("MICROSOFT_CLIENT_SECRET"),
      };
    }
    // Google Workspace (Gmail + Calendar) — access_type=offline + prompt=consent are both
    // required to get a refresh_token back on every connection, not just the first one.
    case "google": {
      return {
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar",
        clientId: requireEnv("GOOGLE_CLIENT_ID"),
        clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
        extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
      };
    }
    default:
      throw new Error(`No OAuth2 provider configured for platform '${platform}'.`);
  }
}

export function buildAuthorizeUrl(platform: string, state: string, redirectUrl: string): string {
  const cfg = getProviderConfig(platform);
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: redirectUrl,
    scope: cfg.scope,
    state,
    ...cfg.extraAuthorizeParams,
  });
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

export interface OAuth2Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

async function tokenRequest(platform: string, body: Record<string, string>, fallbackRefreshToken?: string): Promise<OAuth2Tokens> {
  const cfg = getProviderConfig(platform);
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...body }),
  });
  const responseBody = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (responseBody as { error_description?: string; error?: string })?.error_description
      ?? (responseBody as { error?: string })?.error
      ?? `${platform} OAuth2 token request HTTP ${res.status}`;
    throw new Error(message);
  }
  const { access_token, refresh_token, expires_in } = responseBody as { access_token: string; refresh_token?: string; expires_in?: number };
  if (!access_token) throw new Error(`${platform} token response did not include an access_token.`);
  return { accessToken: access_token, refreshToken: refresh_token ?? fallbackRefreshToken ?? "", expiresAt: Date.now() + (expires_in ?? 3600) * 1000 };
}

export async function exchangeCode(platform: string, code: string, redirectUrl: string): Promise<OAuth2Tokens> {
  const tokens = await tokenRequest(platform, { grant_type: "authorization_code", code, redirect_uri: redirectUrl });
  if (!tokens.refreshToken) {
    throw new Error(
      `${platform} did not return a refresh_token. For Google, this happens on a re-consent when a refresh_token was already issued once before — ` +
        `revoke this app's access in the provider's account settings and reconnect. For Microsoft, confirm the 'offline_access' scope was granted.`,
    );
  }
  return tokens;
}

export function refreshTokens(platform: string, refreshToken: string): Promise<OAuth2Tokens> {
  return tokenRequest(platform, { grant_type: "refresh_token", refresh_token: refreshToken }, refreshToken);
}
