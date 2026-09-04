/** Which credential fields `create_integration` expects per platform — shared between the
 *  in-app Integrations connect picker and the public quick-connect page, so the two don't drift
 *  on what a platform's credentials form actually looks like. See
 *  supabase/functions/hub-mcp-server/tools/integrations.ts's create_integration description for
 *  the authoritative per-platform credential shapes this mirrors. */

// storeUrl (or, for contentful, a space id shown in that same field) + one secret field.
export const TOKEN_AUTH_PLATFORMS = new Set(["shopify", "magento", "typo3", "prestashop", "contentful", "pipedrive", "weclapp", "monday", "browserless", "beeper"]);
// Single-API-key platforms — no store URL, no separate key/secret pair.
export const NO_STORE_URL_PLATFORMS = new Set(["lexoffice", "toggl", "sevdesk", "hubspot", "clockin", "billwerk", "papershift", "steel"]);
// Key + secret pair, no store URL — either an OAuth2 client-credentials pair (personio/datev/jtl,
// same posture as Shopware's clientId/clientSecret without a storeUrl since these aren't per-site
// installs) or, for clockify, a workspace id + API key.
export const CLIENT_CREDENTIALS_PLATFORMS = new Set(["personio", "datev", "jtl", "clockify", "123erfasst", "clockodo", "openhandwerk"]);
// Consent-redirect platforms — no credentials form at all; the user authenticates with the
// provider directly, same auth_type='oauth2' distinction hub_platform_types makes.
export const OAUTH2_PLATFORMS = new Set(["gocardless", "outlook", "google"]);
// The subset of OAUTH2_PLATFORMS that use the generic "redirect straight to the provider, no
// extra picker" flow (start_oauth_connection) rather than GoCardless's bank-country/institution
// picker (start_bank_connection) — see Integrations.tsx.
export const GENERIC_OAUTH2_PLATFORMS = new Set(["outlook", "google"]);

export interface CredentialFields {
  storeUrl: string;
  key: string;
  secret: string;
}

/** Builds the `credentials` object `create_integration` expects for `platform`, from the three
 *  generic form fields every non-OAuth2 platform's form collects (not every platform uses all
 *  three — see the *_PLATFORMS sets above for which fields a given platform's form actually
 *  shows). Not valid for OAUTH2_PLATFORMS — those go through start_bank_connection instead. */
export function buildCredentials(platform: string, { storeUrl, key, secret }: CredentialFields): Record<string, unknown> {
  return platform === "lexoffice" || platform === "sevdesk" ? { apiKey: secret }
    : platform === "toggl" || platform === "clockin" ? { apiToken: secret }
    : platform === "hubspot" ? { accessToken: secret }
    : platform === "billwerk" ? { privateKey: secret }
    : platform === "papershift" ? { apiToken: secret }
    : platform === "steel" ? { apiKey: secret }
    : platform === "wordpress" ? { siteUrl: storeUrl, username: key, appPassword: secret }
    : platform === "typo3" ? { siteUrl: storeUrl, accessToken: secret }
    : platform === "contentful" ? { spaceId: storeUrl, accessToken: secret, ...(key ? { managementToken: key } : {}) }
    : platform === "shopware" ? { storeUrl, clientId: key, clientSecret: secret }
    : platform === "clockify" ? { workspaceId: key, apiKey: secret }
    : platform === "clockodo" ? { email: key, apiKey: secret }
    : platform === "jtl" ? { clientId: key, clientSecret: secret, tenantId: storeUrl }
    : platform === "pipedrive" ? { companyDomain: storeUrl, apiToken: secret }
    : platform === "weclapp" ? { tenant: storeUrl, apiToken: secret }
    : platform === "openhandwerk" ? { accountId: key, apiKey: secret }
    : platform === "browserless" ? { apiKey: secret, ...(storeUrl ? { endpoint: storeUrl } : {}) }
    : platform === "beeper" ? { homeserverUrl: storeUrl, accessToken: secret }
    // monday needs extra board/column ids (dealsBoardId required; contactsBoardId/companiesBoardId/
    // dealAmountColumnId/dealStageColumnId optional) this simple 3-field form has no room for —
    // this covers the two required fields only; set the rest via a direct create_integration call.
    : platform === "monday" ? { dealsBoardId: key, apiToken: secret }
    : CLIENT_CREDENTIALS_PLATFORMS.has(platform) ? { clientId: key, clientSecret: secret }
    : TOKEN_AUTH_PLATFORMS.has(platform) ? { storeUrl, accessToken: secret }
    : { storeUrl, consumerKey: key, consumerSecret: secret };
}
