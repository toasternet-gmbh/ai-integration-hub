import { useI18n } from "../lib/i18n";
import { CLIENT_CREDENTIALS_PLATFORMS, NO_STORE_URL_PLATFORMS, OAUTH2_PLATFORMS, TOKEN_AUTH_PLATFORMS } from "../lib/platformCredentials";

/** The credentials half of a "connect a platform" form — which fields to show and how to label
 *  them, shared between the in-app Integrations connect picker and the public quick-connect page
 *  so the two never show a different form for the same platform. Renders nothing for
 *  OAUTH2_PLATFORMS (gocardless) — that flow has no credentials form at all. */
export function PlatformCredentialFields({
  platform, storeUrl, onStoreUrl, keyValue, onKey, secret, onSecret,
}: {
  platform: string;
  storeUrl: string; onStoreUrl: (v: string) => void;
  keyValue: string; onKey: (v: string) => void;
  secret: string; onSecret: (v: string) => void;
}) {
  const { t } = useI18n();
  if (OAUTH2_PLATFORMS.has(platform)) return null;

  return (
    <>
      {!NO_STORE_URL_PLATFORMS.has(platform) && !CLIENT_CREDENTIALS_PLATFORMS.has(platform) && (
        <div>
          <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
            {(platform === "contentful" ? t("integrations.spaceId") : t("integrations.storeUrl")).toUpperCase()}
          </label>
          <input
            value={storeUrl} onChange={(e) => onStoreUrl(e.target.value)}
            className="w-full px-4 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary"
            placeholder={platform === "contentful" ? undefined : "https://your-store.com"} type={platform === "contentful" ? "text" : "url"}
          />
        </div>
      )}
      {!TOKEN_AUTH_PLATFORMS.has(platform) && !NO_STORE_URL_PLATFORMS.has(platform) && (
        <div>
          <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
            {(
              platform === "clockify" ? t("integrations.workspaceId")
              : platform === "shopware" || CLIENT_CREDENTIALS_PLATFORMS.has(platform) ? t("integrations.clientId")
              : platform === "wordpress" ? t("integrations.username")
              : t("integrations.consumerKey")
            ).toUpperCase()}
          </label>
          <input
            value={keyValue} onChange={(e) => onKey(e.target.value)}
            className="w-full px-4 py-2 border border-outline-variant rounded font-mono-data text-mono-data bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary"
          />
        </div>
      )}
      <div>
        <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
          {(
            platform === "lexoffice" || platform === "toggl" || platform === "sevdesk" || platform === "clockify" ? t("integrations.apiKey")
            : platform === "wordpress" ? t("integrations.applicationPassword")
            : platform === "hubspot" ? t("integrations.accessToken")
            : platform === "prestashop" ? t("integrations.webserviceKey")
            : platform === "shopware" || CLIENT_CREDENTIALS_PLATFORMS.has(platform) ? t("integrations.clientSecret")
            : TOKEN_AUTH_PLATFORMS.has(platform) ? t("integrations.accessToken")
            : t("integrations.consumerSecret")
          ).toUpperCase()}
        </label>
        <input
          value={secret} onChange={(e) => onSecret(e.target.value)} type="password"
          className="w-full px-4 py-2 border border-outline-variant rounded font-mono-data text-mono-data bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary"
          placeholder={platform === "shopify" ? "shpat_..." : undefined}
        />
      </div>
    </>
  );
}
