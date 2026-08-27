/** Single source of truth for "which platforms the Hub connects to, grouped by business
 *  category" — consumed by the Landing page, the public Blueprint page, and the in-app
 *  Integrations connect picker, so the three don't drift out of sync with each other or with
 *  `hub_platform_types.category` in the database (see
 *  supabase/migrations/20260826000000_platform_categories_and_bookkeeping.sql onward). This file
 *  is the frontend's own static mirror of that catalog, not a live fetch from it — the same
 *  pattern the three consumers already used individually before this file existed. */

export type Bi = { en: string; de: string };

export type PlatformCategory = "ecommerce" | "bookkeeping" | "cms" | "time_tracking" | "banking" | "crm";

/** Display order for category groups wherever platforms are grouped. */
export const CATEGORY_ORDER: PlatformCategory[] = ["ecommerce", "bookkeeping", "cms", "time_tracking", "banking", "crm"];

export const CATEGORY_LABEL: Record<PlatformCategory, Bi> = {
  ecommerce: { en: "E-commerce", de: "E-Commerce" },
  bookkeeping: { en: "Bookkeeping", de: "Buchhaltung" },
  cms: { en: "CMS", de: "CMS" },
  time_tracking: { en: "Time tracking", de: "Zeiterfassung" },
  banking: { en: "Banking", de: "Banking" },
  crm: { en: "CRM", de: "CRM" },
};

export interface PlatformMeta {
  id: string;
  category: PlatformCategory;
  /** Brand name — not translated. */
  name: string;
  /** Material Symbols icon token. */
  icon: string;
  /** Brand-ish accent color, used as a tint for icon chips. */
  color: string;
  /** One-line description of what connecting this platform actually gets you. */
  description: Bi;
}

export const PLATFORM_CATALOG: PlatformMeta[] = [
  {
    id: "woocommerce", category: "ecommerce", name: "WooCommerce", icon: "storefront", color: "#7F54B3",
    description: {
      en: "Order search, lookup, and refunds, plus product and inventory tools.",
      de: "Bestellsuche, -abfrage und -erstattungen sowie Produkt- und Lager-Tools.",
    },
  },
  {
    id: "shopware", category: "ecommerce", name: "Shopware 6", icon: "inventory_2", color: "#189EFF",
    description: {
      en: "Order search, lookup, and refunds, plus product and inventory tools, via Shopware's OAuth2 API.",
      de: "Bestellsuche, -abfrage und -erstattungen sowie Produkt- und Lager-Tools über die OAuth2-API von Shopware.",
    },
  },
  {
    id: "shopify", category: "ecommerce", name: "Shopify", icon: "shopping_bag", color: "#95BF47",
    description: {
      en: "Order search, lookup, and refunds, plus product and inventory tools.",
      de: "Bestellsuche, -abfrage und -erstattungen sowie Produkt- und Lager-Tools.",
    },
  },
  {
    id: "magento", category: "ecommerce", name: "Magento", icon: "shopping_cart", color: "#EE672F",
    description: {
      en: "Order search, lookup, and refunds, plus product and inventory tools.",
      de: "Bestellsuche, -abfrage und -erstattungen sowie Produkt- und Lager-Tools.",
    },
  },
  {
    id: "lexoffice", category: "bookkeeping", name: "Lexoffice", icon: "receipt_long", color: "#6CC24A",
    description: {
      en: "Invoice and contact search, plus invoice lookup, via Lexoffice's bookkeeping API.",
      de: "Rechnungs- und Kontaktsuche sowie Rechnungsabfrage über die Buchhaltungs-API von Lexoffice.",
    },
  },
  {
    id: "wordpress", category: "cms", name: "WordPress", icon: "edit_note", color: "#21759B",
    description: {
      en: "Page search and lookup via the WordPress REST API, authenticated with an Application Password.",
      de: "Seitensuche und -abfrage über die WordPress-REST-API, authentifiziert mit einem Anwendungspasswort.",
    },
  },
  {
    id: "toggl", category: "time_tracking", name: "Toggl Track", icon: "schedule", color: "#E01B84",
    description: {
      en: "Time entry search and lookup against a Toggl Track workspace.",
      de: "Suche und Abfrage von Zeiteinträgen in einem Toggl-Track-Workspace.",
    },
  },
  {
    id: "gocardless", category: "banking", name: "GoCardless", icon: "account_balance", color: "#191919",
    description: {
      en: "Read-only bank account and transaction access via GoCardless Bank Account Data — connect by authenticating with your bank, no API key needed.",
      de: "Lesender Zugriff auf Bankkonten und Transaktionen über GoCardless Bank Account Data — Verbindung per Bank-Login, kein API-Schlüssel nötig.",
    },
  },
  {
    id: "sevdesk", category: "bookkeeping", name: "sevDesk", icon: "request_quote", color: "#00A88E",
    description: {
      en: "Invoice and contact search, plus invoice lookup, via sevDesk's bookkeeping API.",
      de: "Rechnungs- und Kontaktsuche sowie Rechnungsabfrage über die Buchhaltungs-API von sevDesk.",
    },
  },
  {
    id: "personio", category: "time_tracking", name: "Personio", icon: "event_available", color: "#FF6B4A",
    description: {
      en: "Attendance period search and lookup via Personio's HR platform.",
      de: "Suche und Abfrage von Anwesenheitszeiträumen über die HR-Plattform Personio.",
    },
  },
  {
    id: "datev", category: "bookkeeping", name: "DATEV", icon: "calculate", color: "#00854A",
    description: {
      en: "Invoice and contact access via DATEV — requires DATEV Marktplatz partner certification; not self-serve like the other bookkeeping platforms.",
      de: "Rechnungs- und Kontaktzugriff über DATEV — erfordert eine DATEV-Marktplatz-Partnerzertifizierung, nicht selbstständig einrichtbar wie die anderen Buchhaltungsplattformen.",
    },
  },
  {
    id: "jtl", category: "ecommerce", name: "JTL", icon: "warehouse", color: "#FF6600",
    description: {
      en: "Order, product, and inventory tools via JTL's Channel/Platform API — connects a JTL sales channel, not a JTL-Wawi installation directly.",
      de: "Bestell-, Produkt- und Lager-Tools über die JTL-Channel-/Platform-API — verbindet einen JTL-Vertriebskanal, nicht direkt eine JTL-Wawi-Installation.",
    },
  },
  {
    id: "typo3", category: "cms", name: "TYPO3", icon: "web", color: "#FF8700",
    description: {
      en: "Page search and lookup — requires the target site to have a REST API extension (e.g. cundd/rest) installed; TYPO3 core has none built in.",
      de: "Seitensuche und -abfrage — erfordert eine installierte REST-API-Extension (z. B. cundd/rest) auf der Zielseite; der TYPO3-Kern bringt keine mit.",
    },
  },
  {
    id: "contentful", category: "cms", name: "Contentful", icon: "cloud_queue", color: "#3C8DBC",
    description: {
      en: "Page search and lookup via Contentful's Content Delivery API, a real REST surface built for exactly this.",
      de: "Seitensuche und -abfrage über die Content-Delivery-API von Contentful, eine echte REST-Schnittstelle genau dafür.",
    },
  },
  {
    id: "clockify", category: "time_tracking", name: "Clockify", icon: "timer", color: "#03A9F4",
    description: {
      en: "Time entry search and lookup against a Clockify workspace.",
      de: "Suche und Abfrage von Zeiteinträgen in einem Clockify-Workspace.",
    },
  },
  {
    id: "prestashop", category: "ecommerce", name: "PrestaShop", icon: "local_mall", color: "#DF0067",
    description: {
      en: "Order and product search and lookup via PrestaShop's Webservice API.",
      de: "Bestell- und Produktsuche sowie -abfrage über die Webservice-API von PrestaShop.",
    },
  },
  {
    id: "hubspot", category: "crm", name: "HubSpot", icon: "handshake", color: "#FF7A59",
    description: {
      en: "Contact and deal search and lookup via HubSpot's CRM API — the Hub's first CRM platform.",
      de: "Kontakt- und Deal-Suche sowie -Abfrage über die CRM-API von HubSpot — die erste CRM-Plattform des Hubs.",
    },
  },
];

export interface PlatformGroup {
  category: PlatformCategory;
  platforms: PlatformMeta[];
}

/** `PLATFORM_CATALOG` grouped and ordered by `CATEGORY_ORDER`, skipping any category with no
 *  platforms in it yet. */
export function platformsByCategory(): PlatformGroup[] {
  return CATEGORY_ORDER.map((category) => ({ category, platforms: PLATFORM_CATALOG.filter((p) => p.category === category) })).filter(
    (g) => g.platforms.length > 0,
  );
}
