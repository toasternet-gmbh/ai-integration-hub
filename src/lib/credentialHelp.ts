import type { Bi } from "./platformCatalog";

/** Plain-language "where do I find this?" help, shown above the credential fields on both the
 *  quick-connect page and the in-app Integrations connect picker — the field labels themselves
 *  ("Admin API access token", "Client secret", ...) are accurate but assume the reader already
 *  knows what that is and where their platform keeps it, which a non-technical shop owner filling
 *  this form for the first time usually doesn't.
 *
 *  Six of these (magento, personio, contentful, clockify, prestashop, hubspot) are copied from the
 *  exact admin-path each connector's own header comment documents
 *  (supabase/functions/hub-mcp-server/lib/connectors/<id>.ts) — verified against the code, not
 *  guessed. The rest are either well-established, stable platform conventions (woocommerce,
 *  shopware, shopify, wordpress, toggl) or, where the connector itself flags real uncertainty
 *  (datev, jtl, typo3) or this file's author simply isn't sure of the current exact menu wording
 *  (lexoffice, sevdesk), a deliberately generic pointer rather than an invented specific path —
 *  a wrong navigation instruction is worse than a vague one. */
export const CREDENTIAL_HELP: Record<string, Bi> = {
  woocommerce: {
    en: "In your WordPress admin, go to WooCommerce → Settings → Advanced → REST API, then \"Add key\" to generate a Consumer key and Consumer secret.",
    de: "Gehen Sie in Ihrem WordPress-Admin zu WooCommerce → Einstellungen → Erweitert → REST-API und klicken Sie auf „Schlüssel hinzufügen“, um Consumer Key und Consumer Secret zu erzeugen.",
  },
  shopware: {
    en: "In your Shopware admin, go to Settings → System → Integrations and create a new integration — it gives you an Access ID (Client ID) and Secret Access Key (Client secret).",
    de: "Gehen Sie in Ihrem Shopware-Admin zu Einstellungen → System → Integrationen und legen Sie eine neue Integration an — Sie erhalten eine Access-ID (Client-ID) und einen Secret Access Key (Client Secret).",
  },
  shopify: {
    en: "In your Shopify admin, go to Settings → Apps and sales channels → Develop apps, create a custom app, grant it the permissions it needs, then reveal its Admin API access token.",
    de: "Gehen Sie in Ihrem Shopify-Admin zu Einstellungen → Apps und Vertriebskanäle → Apps entwickeln, erstellen Sie eine benutzerdefinierte App, erteilen Sie ihr die nötigen Berechtigungen und lassen Sie sich dann das Admin-API-Zugriffstoken anzeigen.",
  },
  magento: {
    en: "In your Magento admin, go to System → Extensions → Integrations, create a new integration, and activate it — that's your access token.",
    de: "Gehen Sie in Ihrem Magento-Admin zu System → Extensions → Integrations, legen Sie eine neue Integration an und aktivieren Sie sie — das ist Ihr Access Token.",
  },
  lexoffice: {
    en: "Generate an API key from your Lexoffice account's API/developer settings.",
    de: "Erzeugen Sie einen API-Schlüssel in den API-/Entwicklereinstellungen Ihres Lexoffice-Kontos.",
  },
  wordpress: {
    en: "In WordPress, go to Users → Profile (your own account), scroll to \"Application Passwords\", and create one — a WordPress core feature since version 5.6, separate from your normal login password.",
    de: "Gehen Sie in WordPress zu Benutzer → Profil (Ihr eigenes Konto), scrollen Sie zu „Anwendungspasswörter“ und erstellen Sie eines — eine WordPress-Kernfunktion seit Version 5.6, getrennt von Ihrem normalen Anmeldepasswort.",
  },
  toggl: {
    en: "In Toggl Track, open your profile settings — your API token is shown near the bottom of the page.",
    de: "Öffnen Sie in Toggl Track Ihre Profileinstellungen — Ihr API-Token wird weiter unten auf der Seite angezeigt.",
  },
  sevdesk: {
    en: "Generate an API token from your sevDesk account's user/profile settings.",
    de: "Erzeugen Sie ein API-Token in den Benutzer-/Profileinstellungen Ihres sevDesk-Kontos.",
  },
  personio: {
    en: "In Personio, go to Marketplace → Connected integrations → \"Create custom integration\" to get a client ID and client secret.",
    de: "Gehen Sie in Personio zu Marketplace → Verbundene Integrationen → „Individuelle Integration erstellen“, um Client-ID und Client-Secret zu erhalten.",
  },
  datev: {
    en: "DATEV has no self-service way to generate this — it requires becoming a certified DATEV Marktplatz partner first.",
    de: "Dafür gibt es bei DATEV keine Selbstbedienungsmöglichkeit — dafür ist zunächst eine zertifizierte DATEV-Marktplatz-Partnerschaft nötig.",
  },
  jtl: {
    en: "Generated from JTL's Cloud/Channel platform for your sales channel — check JTL's own developer documentation for the current location.",
    de: "Wird über die JTL-Cloud-/Channel-Plattform für Ihren Vertriebskanal erzeugt — die aktuelle Stelle dafür finden Sie in JTLs eigener Entwicklerdokumentation.",
  },
  typo3: {
    en: "Requires the cundd/rest extension installed on your TYPO3 site — ask whoever manages your site's extensions for its access token.",
    de: "Erfordert die auf Ihrer TYPO3-Seite installierte Extension cundd/rest — fragen Sie diejenige Person, die Ihre Seiten-Extensions verwaltet, nach dem Zugriffstoken.",
  },
  contentful: {
    en: "In Contentful, go to Settings → API keys in your space to get an access token.",
    de: "Gehen Sie in Contentful in Ihrem Space zu Einstellungen → API-Schlüssel, um ein Zugriffstoken zu erhalten.",
  },
  clockify: {
    en: "In Clockify, open your profile settings — your API key is listed there.",
    de: "Öffnen Sie in Clockify Ihre Profileinstellungen — dort ist Ihr API-Schlüssel aufgeführt.",
  },
  prestashop: {
    en: "In your PrestaShop admin, go to Advanced Parameters → Webservice, enable it if it isn't already, and add a key.",
    de: "Gehen Sie in Ihrem PrestaShop-Admin zu Erweiterte Parameter → Webservice, aktivieren Sie ihn falls nötig, und fügen Sie einen Schlüssel hinzu.",
  },
  hubspot: {
    en: "In HubSpot, go to Settings → Integrations → Private Apps, create one, and copy its access token.",
    de: "Gehen Sie in HubSpot zu Einstellungen → Integrationen → Private Apps, erstellen Sie eine und kopieren Sie deren Zugriffstoken.",
  },
};
