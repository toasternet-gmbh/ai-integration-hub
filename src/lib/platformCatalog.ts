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

/** One canonical-tool group, e.g. `{ domain: "orders", tools: ["orders.search", ...] }` —
 *  intentionally the same shape as `Capability` in
 *  supabase/functions/hub-mcp-server/lib/connectors/types.ts. */
export interface PlatformCapability {
  domain: string;
  tools: string[];
}

/** One-line, human/AI-readable description per canonical tool name, keyed the same way
 *  `hub-mcp-server`'s `tools/*.ts` modules name them (`orders.search`, `cms.pages.get`, ...).
 *  Wording mirrors each tool's `description` in those modules — kept short here since this
 *  renders as a list/badge, not a full sentence. Update alongside a tool module change. */
export const TOOL_INFO: Record<string, Bi> = {
  "orders.search": { en: "Search orders", de: "Bestellungen durchsuchen" },
  "orders.get": { en: "Look up an order", de: "Bestellung abrufen" },
  "orders.refund": { en: "Refund an order", de: "Bestellung erstatten" },
  "products.search": { en: "Search products", de: "Produkte durchsuchen" },
  "products.get": { en: "Look up a product", de: "Produkt abrufen" },
  "products.update_price": { en: "Update a product's price", de: "Produktpreis ändern" },
  "inventory.get_stock": { en: "Check stock level", de: "Lagerbestand abfragen" },
  "inventory.update_stock": { en: "Update stock level", de: "Lagerbestand ändern" },
  "invoices.search": { en: "Search invoices", de: "Rechnungen durchsuchen" },
  "invoices.get": { en: "Look up an invoice", de: "Rechnung abrufen" },
  "contacts.search": { en: "Search contacts", de: "Kontakte durchsuchen" },
  "contacts.get": { en: "Look up a contact", de: "Kontakt abrufen" },
  "contacts.create": { en: "Create a contact", de: "Kontakt erstellen" },
  "invoices.create": { en: "Create an invoice", de: "Rechnung erstellen" },
  "reports.profit_and_loss": { en: "Get a profit & loss report", de: "Gewinn-und-Verlust-Bericht abrufen" },
  "products.create": { en: "Create a product", de: "Produkt erstellen" },
  "vouchers.create_from_file": { en: "Book an expense from a receipt", de: "Ausgabe aus Beleg buchen" },
  "orders.cancel": { en: "Cancel an order", de: "Bestellung stornieren" },
  "orders.fulfill": { en: "Mark an order shipped", de: "Bestellung als versandt markieren" },
  "cms.pages.search": { en: "Search pages", de: "Seiten durchsuchen" },
  "cms.pages.get": { en: "Look up a page", de: "Seite abrufen" },
  "time_entries.search": { en: "Search time entries", de: "Zeiteinträge durchsuchen" },
  "time_entries.get": { en: "Look up a time entry", de: "Zeiteintrag abrufen" },
  "time_entries.create": { en: "Log a time entry", de: "Zeiteintrag erfassen" },
  "time_entries.update": { en: "Update a time entry", de: "Zeiteintrag aktualisieren" },
  "time_entries.delete": { en: "Delete a time entry", de: "Zeiteintrag löschen" },
  "accounts.list": { en: "List bank accounts", de: "Bankkonten auflisten" },
  "transactions.search": { en: "Search transactions", de: "Transaktionen durchsuchen" },
  "deals.search": { en: "Search deals", de: "Deals durchsuchen" },
  "deals.get": { en: "Look up a deal", de: "Deal abrufen" },
  "deals.create": { en: "Create a deal", de: "Deal erstellen" },
  "companies.search": { en: "Search companies", de: "Unternehmen durchsuchen" },
  "companies.get": { en: "Look up a company", de: "Unternehmen abrufen" },
  "cms.posts.search": { en: "Search blog posts", de: "Blogbeiträge durchsuchen" },
  "cms.posts.get": { en: "Look up a blog post", de: "Blogbeitrag abrufen" },
  "cms.posts.create": { en: "Create a blog post", de: "Blogbeitrag erstellen" },
  "cms.posts.update": { en: "Update a blog post", de: "Blogbeitrag aktualisieren" },
  "cms.pages.create": { en: "Create a content entry", de: "Content-Eintrag erstellen" },
};

export type VerificationStatus = "unverified" | "api_verified" | "real_customer_verified";

export const VERIFICATION_LABEL: Record<VerificationStatus, Bi> = {
  unverified: { en: "Unverified", de: "Ungeprüft" },
  api_verified: { en: "API verified", de: "API geprüft" },
  real_customer_verified: { en: "Real customer verified", de: "Bei echtem Kunden geprüft" },
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
  /** Static mirror of `hub_platform_types.verification_status` (see
   *  supabase/migrations/20260902000000_hub_platform_types_verification_status.sql) — how
   *  thoroughly this connector has actually been confirmed to work, for public/marketing display.
   *  The DB row is the editable source of truth (superadmin's Platforms page changes it); update
   *  this mirror to match whenever that changes. */
  verificationStatus: VerificationStatus;
  /** Canonical tools this platform's connector exposes to agents, grouped by domain. Static
   *  mirror of that connector's own `getCapabilities()` in
   *  supabase/functions/hub-mcp-server/lib/connectors/<id>.ts — for pre-connection display
   *  (marketing pages, docs, the connect picker's platform preview) only. It is NOT what confirms
   *  a real connection: `Integrations.tsx` deliberately re-fetches the actual capabilities
   *  `create_integration` returns for that purpose, rather than trusting this list, since the
   *  live result is the source of truth once an integration exists. */
  capabilities: PlatformCapability[];
}

/** Legacy shared shape — still used by JTL (best-effort/unverified), which hasn't had the
 *  contacts/cancel/fulfill additions extended to it yet. */
const ECOMMERCE_CAPABILITIES: PlatformCapability[] = [
  { domain: "orders", tools: ["orders.search", "orders.get", "orders.refund"] },
  { domain: "products", tools: ["products.search", "products.get", "products.update_price"] },
  { domain: "inventory", tools: ["inventory.get_stock", "inventory.update_stock"] },
];

/** Shopify/Magento/Shopware all have a real, distinct order-cancel endpoint and a real
 *  tracking-number field for fulfillment — WooCommerce core has neither (no tracking field at
 *  all), so it gets its own, slightly smaller capability list below instead of sharing this one. */
const FULL_ECOMMERCE_CAPABILITIES: PlatformCapability[] = [
  { domain: "orders", tools: ["orders.search", "orders.get", "orders.refund", "orders.cancel", "orders.fulfill"] },
  { domain: "products", tools: ["products.search", "products.get", "products.update_price"] },
  { domain: "inventory", tools: ["inventory.get_stock", "inventory.update_stock"] },
  { domain: "contacts", tools: ["contacts.search", "contacts.get"] },
];

const WOOCOMMERCE_CAPABILITIES: PlatformCapability[] = [
  { domain: "orders", tools: ["orders.search", "orders.get", "orders.refund", "orders.cancel"] },
  { domain: "products", tools: ["products.search", "products.get", "products.update_price"] },
  { domain: "inventory", tools: ["inventory.get_stock", "inventory.update_stock"] },
  { domain: "contacts", tools: ["contacts.search", "contacts.get"] },
];

const BOOKKEEPING_CAPABILITIES: PlatformCapability[] = [
  { domain: "invoices", tools: ["invoices.search", "invoices.get"] },
  { domain: "contacts", tools: ["contacts.search", "contacts.get"] },
];

const CMS_CAPABILITIES: PlatformCapability[] = [{ domain: "cms", tools: ["cms.pages.search", "cms.pages.get"] }];

const TIME_TRACKING_CAPABILITIES: PlatformCapability[] = [
  { domain: "time_entries", tools: ["time_entries.search", "time_entries.get", "time_entries.create", "time_entries.update", "time_entries.delete"] },
];

export const PLATFORM_CATALOG: PlatformMeta[] = [
  {
    id: "woocommerce", category: "ecommerce", name: "WooCommerce", icon: "storefront", color: "#7F54B3",
    description: {
      en: "Order search, lookup, refunds, and cancellation, plus product, inventory, and customer tools.",
      de: "Bestellsuche, -abfrage, -erstattung und -stornierung sowie Produkt-, Lager- und Kunden-Tools.",
    },
    capabilities: WOOCOMMERCE_CAPABILITIES,
    verificationStatus: "api_verified",
  },
  {
    id: "shopware", category: "ecommerce", name: "Shopware 6", icon: "inventory_2", color: "#189EFF",
    description: {
      en: "Order search, lookup, refunds, cancellation, and shipment tracking, plus product, inventory, and customer tools, via Shopware's OAuth2 API.",
      de: "Bestellsuche, -abfrage, -erstattung, -stornierung und Sendungsverfolgung sowie Produkt-, Lager- und Kunden-Tools über die OAuth2-API von Shopware.",
    },
    capabilities: FULL_ECOMMERCE_CAPABILITIES,
    verificationStatus: "api_verified",
  },
  {
    id: "shopify", category: "ecommerce", name: "Shopify", icon: "shopping_bag", color: "#95BF47",
    description: {
      en: "Order search, lookup, refunds, cancellation, and shipment tracking, plus product, inventory, and customer tools.",
      de: "Bestellsuche, -abfrage, -erstattung, -stornierung und Sendungsverfolgung sowie Produkt-, Lager- und Kunden-Tools.",
    },
    capabilities: FULL_ECOMMERCE_CAPABILITIES,
    verificationStatus: "api_verified",
  },
  {
    id: "magento", category: "ecommerce", name: "Magento", icon: "shopping_cart", color: "#EE672F",
    description: {
      en: "Order search, lookup, refunds, cancellation, and shipment tracking, plus product, inventory, and customer tools.",
      de: "Bestellsuche, -abfrage, -erstattung, -stornierung und Sendungsverfolgung sowie Produkt-, Lager- und Kunden-Tools.",
    },
    capabilities: FULL_ECOMMERCE_CAPABILITIES,
    verificationStatus: "unverified",
  },
  {
    id: "lexoffice", category: "bookkeeping", name: "Lexoffice", icon: "receipt_long", color: "#6CC24A",
    description: {
      en: "Invoice and contact search, lookup, and creation via Lexoffice's bookkeeping API.",
      de: "Rechnungs- und Kontaktsuche, -abfrage und -erstellung über die Buchhaltungs-API von Lexoffice.",
    },
    capabilities: [
      { domain: "invoices", tools: ["invoices.search", "invoices.get", "invoices.create"] },
      { domain: "contacts", tools: ["contacts.search", "contacts.get", "contacts.create"] },
      { domain: "products", tools: ["products.create"] },
    ],
    verificationStatus: "api_verified",
  },
  {
    id: "wordpress", category: "cms", name: "WordPress", icon: "edit_note", color: "#21759B",
    description: {
      en: "Page search and lookup, plus blog post search, lookup, creation, and editing, via the WordPress REST API, authenticated with an Application Password.",
      de: "Seitensuche und -abfrage sowie Blogbeitrags-Suche, -Abfrage, -Erstellung und -Bearbeitung über die WordPress-REST-API, authentifiziert mit einem Anwendungspasswort.",
    },
    capabilities: [
      { domain: "cms", tools: ["cms.pages.search", "cms.pages.get", "cms.posts.search", "cms.posts.get", "cms.posts.create", "cms.posts.update"] },
    ],
    verificationStatus: "api_verified",
  },
  {
    id: "toggl", category: "time_tracking", name: "Toggl Track", icon: "schedule", color: "#E01B84",
    description: {
      en: "Time entry search, lookup, logging, editing, and deletion against a Toggl Track workspace.",
      de: "Suche, Abfrage, Erfassung, Bearbeitung und Löschung von Zeiteinträgen in einem Toggl-Track-Workspace.",
    },
    capabilities: TIME_TRACKING_CAPABILITIES,
    verificationStatus: "api_verified",
  },
  {
    id: "gocardless", category: "banking", name: "GoCardless", icon: "account_balance", color: "#191919",
    description: {
      en: "Read-only bank account and transaction access via GoCardless Bank Account Data — connect by authenticating with your bank, no API key needed.",
      de: "Lesender Zugriff auf Bankkonten und Transaktionen über GoCardless Bank Account Data — Verbindung per Bank-Login, kein API-Schlüssel nötig.",
    },
    capabilities: [
      { domain: "accounts", tools: ["accounts.list"] },
      { domain: "transactions", tools: ["transactions.search"] },
    ],
    verificationStatus: "api_verified",
  },
  {
    id: "sevdesk", category: "bookkeeping", name: "sevDesk", icon: "request_quote", color: "#00A88E",
    description: {
      en: "Invoice and contact search, lookup, and creation, plus a profit-and-loss report, via sevDesk's bookkeeping API.",
      de: "Rechnungs- und Kontaktsuche, -abfrage und -erstellung sowie ein Gewinn-und-Verlust-Bericht über die Buchhaltungs-API von sevDesk.",
    },
    capabilities: [
      { domain: "invoices", tools: ["invoices.search", "invoices.get", "invoices.create"] },
      { domain: "contacts", tools: ["contacts.search", "contacts.get", "contacts.create"] },
      { domain: "reports", tools: ["reports.profit_and_loss"] },
      { domain: "products", tools: ["products.create"] },
      { domain: "vouchers", tools: ["vouchers.create_from_file"] },
    ],
    verificationStatus: "api_verified",
  },
  {
    id: "personio", category: "time_tracking", name: "Personio", icon: "event_available", color: "#FF6B4A",
    description: {
      en: "Attendance period search, lookup, logging, editing, and deletion via Personio's HR platform.",
      de: "Suche, Abfrage, Erfassung, Bearbeitung und Löschung von Anwesenheitszeiträumen über die HR-Plattform Personio.",
    },
    capabilities: TIME_TRACKING_CAPABILITIES,
    verificationStatus: "api_verified",
  },
  {
    id: "datev", category: "bookkeeping", name: "DATEV", icon: "calculate", color: "#00854A",
    description: {
      en: "Invoice and contact access via DATEV — requires DATEV Marktplatz partner certification; not self-serve like the other bookkeeping platforms.",
      de: "Rechnungs- und Kontaktzugriff über DATEV — erfordert eine DATEV-Marktplatz-Partnerzertifizierung, nicht selbstständig einrichtbar wie die anderen Buchhaltungsplattformen.",
    },
    capabilities: BOOKKEEPING_CAPABILITIES,
    verificationStatus: "unverified",
  },
  {
    id: "jtl", category: "ecommerce", name: "JTL", icon: "warehouse", color: "#FF6600",
    description: {
      en: "Order, product, and inventory tools via JTL's Channel/Platform API — connects a JTL sales channel, not a JTL-Wawi installation directly.",
      de: "Bestell-, Produkt- und Lager-Tools über die JTL-Channel-/Platform-API — verbindet einen JTL-Vertriebskanal, nicht direkt eine JTL-Wawi-Installation.",
    },
    capabilities: ECOMMERCE_CAPABILITIES,
    verificationStatus: "unverified",
  },
  {
    id: "typo3", category: "cms", name: "TYPO3", icon: "web", color: "#FF8700",
    description: {
      en: "Page search and lookup — requires the target site to have a REST API extension (e.g. cundd/rest) installed; TYPO3 core has none built in.",
      de: "Seitensuche und -abfrage — erfordert eine installierte REST-API-Extension (z. B. cundd/rest) auf der Zielseite; der TYPO3-Kern bringt keine mit.",
    },
    capabilities: CMS_CAPABILITIES,
    verificationStatus: "unverified",
  },
  {
    id: "contentful", category: "cms", name: "Contentful", icon: "cloud_queue", color: "#3C8DBC",
    description: {
      en: "Page search and lookup via Contentful's Content Delivery API, plus entry creation via the Content Management API if a management token is provided.",
      de: "Seitensuche und -abfrage über die Content-Delivery-API von Contentful, plus Eintragserstellung über die Content-Management-API bei hinterlegtem Management-Token.",
    },
    capabilities: [{ domain: "cms", tools: ["cms.pages.search", "cms.pages.get", "cms.pages.create"] }],
    verificationStatus: "api_verified",
  },
  {
    id: "clockify", category: "time_tracking", name: "Clockify", icon: "timer", color: "#03A9F4",
    description: {
      en: "Time entry search, lookup, logging, editing, and deletion against a Clockify workspace.",
      de: "Suche, Abfrage, Erfassung, Bearbeitung und Löschung von Zeiteinträgen in einem Clockify-Workspace.",
    },
    capabilities: TIME_TRACKING_CAPABILITIES,
    verificationStatus: "api_verified",
  },
  {
    id: "prestashop", category: "ecommerce", name: "PrestaShop", icon: "local_mall", color: "#DF0067",
    description: {
      en: "Order search, lookup, refunds, and cancellation, plus product, inventory, and customer tools, via PrestaShop's Webservice API.",
      de: "Bestellsuche, -abfrage, -erstattung und -stornierung sowie Produkt-, Lager- und Kunden-Tools über die Webservice-API von PrestaShop.",
    },
    capabilities: [
      { domain: "orders", tools: ["orders.search", "orders.get", "orders.refund", "orders.cancel"] },
      { domain: "products", tools: ["products.search", "products.get", "products.update_price"] },
      { domain: "inventory", tools: ["inventory.get_stock", "inventory.update_stock"] },
      { domain: "contacts", tools: ["contacts.search", "contacts.get"] },
    ],
    verificationStatus: "api_verified",
  },
  {
    id: "hubspot", category: "crm", name: "HubSpot", icon: "handshake", color: "#FF7A59",
    description: {
      en: "Contact, deal, and company search, lookup, and creation via HubSpot's CRM API — the Hub's first CRM platform.",
      de: "Kontakt-, Deal- und Unternehmenssuche, -abfrage und -erstellung über die CRM-API von HubSpot — die erste CRM-Plattform des Hubs.",
    },
    capabilities: [
      { domain: "contacts", tools: ["contacts.search", "contacts.get", "contacts.create"] },
      { domain: "deals", tools: ["deals.search", "deals.get", "deals.create"] },
      { domain: "companies", tools: ["companies.search", "companies.get"] },
    ],
    verificationStatus: "api_verified",
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

/** Flat `{tool, description}` list for one platform, sourced from `TOOL_INFO` — the shape
 *  every consumer wants when rendering "functions this connector gives your agents." */
export function platformToolList(p: PlatformMeta): { tool: string; description: Bi }[] {
  return p.capabilities.flatMap((c) => c.tools.map((tool) => ({ tool, description: TOOL_INFO[tool] ?? { en: tool, de: tool } })));
}

export const VERIFICATION_TONE: Record<VerificationStatus, string> = {
  unverified: "bg-error-container text-on-error-container",
  api_verified: "bg-tertiary-container text-on-tertiary-container",
  real_customer_verified: "bg-secondary-container text-on-secondary-container",
};
