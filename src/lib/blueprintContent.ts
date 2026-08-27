/** Bilingual content for the public "Blueprint" page (src/pages/Blueprint.tsx) — how the Hub is
 * put together, who can do what, and the workflows every console screen drives. Kept as a
 * dedicated data file (same pattern as helpArticles.ts) rather than inline JSX, so the English and
 * German copy sit next to each other and stay easy to review together. */

export type Bi = { en: string; de: string };

export const POLICY_STEPS: Bi[] = [
  {
    en: "Hub-wide switch — a platform admin can turn a tool off everywhere, instantly, regardless of any agent's own settings.",
    de: "Hub-weiter Schalter — ein Plattform-Admin kann ein Tool sofort und überall abschalten, unabhängig von den Einstellungen einzelner Agenten.",
  },
  {
    en: "Default policy — every tool ships with a sensible default. Reads like orders.search default to Allow; a real financial action like orders.refund defaults to Require approval.",
    de: "Standardrichtlinie — jedes Tool hat eine sinnvolle Vorgabe. Lesevorgänge wie orders.search sind standardmäßig erlaubt; eine echte finanzielle Aktion wie orders.refund erfordert standardmäßig eine Freigabe.",
  },
  {
    en: "Per-agent override — set Allow, Require approval, or Deny for one tool on one agent, and narrow it further to a single integration if needed.",
    de: "Override je Agent — legen Sie für ein Tool bei einem Agenten Erlauben, Freigabe erforderlich oder Verweigern fest, bei Bedarf sogar begrenzt auf eine einzelne Integration.",
  },
  {
    en: "Approve runs it for real — approving a pending request executes the action immediately against the connected integration. There's no separate unlock-and-retry step.",
    de: "Genehmigen führt es wirklich aus — die Genehmigung einer ausstehenden Anfrage führt die Aktion sofort in der verbundenen Integration aus. Es gibt keinen separaten Freischalt-Schritt.",
  },
];

export type Role = { name: Bi; scope: Bi; points: Bi[] };

export const ROLES: Role[] = [
  {
    name: { en: "Organization", de: "Organisation" },
    scope: { en: "Owner · Admin · Member", de: "Owner · Admin · Member" },
    points: [
      { en: "Owners and Admins manage billing and can create and rename projects.", de: "Owner und Admins verwalten die Abrechnung und können Projekte anlegen und umbenennen." },
      { en: "Members can see everything across the organization's projects but can't change settings.", de: "Members sehen alles in den Projekten der Organisation, können aber keine Einstellungen ändern." },
    ],
  },
  {
    name: { en: "Project", de: "Projekt" },
    scope: { en: "Owner · Admin · Member", de: "Owner · Admin · Member" },
    points: [
      { en: "Owners and Admins connect integrations, create agents, set tool permissions, and approve or deny pending requests.", de: "Owner und Admins verbinden Integrationen, legen Agenten an, setzen Tool-Berechtigungen und genehmigen oder lehnen ausstehende Anfragen ab." },
      { en: "Members have read-only access to everything in the project — integrations, agents, approvals, and the audit log.", de: "Members haben Lesezugriff auf alles im Projekt — Integrationen, Agenten, Freigaben und das Audit-Log." },
    ],
  },
  {
    name: { en: "Platform admin", de: "Plattform-Admin" },
    scope: { en: "Hub operators only", de: "Nur für Hub-Betreiber" },
    points: [
      { en: "Manages every organization and user on the Hub, not just one.", de: "Verwaltet jede Organisation und jeden Nutzer im Hub, nicht nur eine einzelne." },
      { en: "Configures the Hub-wide tool and platform catalog that every organization's projects draw from.", de: "Konfiguriert den Hub-weiten Tool- und Plattform-Katalog, aus dem die Projekte aller Organisationen schöpfen." },
      { en: "Most people using the Hub never see this role — it belongs to the team operating the Hub itself.", de: "Die meisten Nutzer des Hubs sehen diese Rolle nie — sie gehört dem Team, das den Hub selbst betreibt." },
    ],
  },
];

export type Workflow = { title: Bi; tag: Bi; body: Bi };

export const WORKFLOWS: Workflow[] = [
  {
    title: { en: "Set up your workspace", de: "Arbeitsbereich einrichten" },
    tag: { en: "First sign-in", de: "Erste Anmeldung" },
    body: {
      en: "Create your organization — the company-level container that owns billing and every project — then create your first project inside it. A project groups one product's integrations, agents, and approvals.",
      de: "Legen Sie Ihre Organisation an — den Container auf Unternehmensebene, dem die Abrechnung und alle Projekte gehören — und erstellen Sie darin Ihr erstes Projekt. Ein Projekt bündelt die Integrationen, Agenten und Freigaben eines Produkts.",
    },
  },
  {
    title: { en: "Connect a system", de: "Ein System verbinden" },
    tag: { en: "Integrations", de: "Integrationen" },
    body: {
      en: "Pick a platform — a store, your bookkeeping, a CMS, time tracking, or a bank connection — enter its credentials (or, for bank connections, authenticate via redirect), and the Hub encrypts them, connects, and discovers which canonical tools are actually usable against it.",
      de: "Wählen Sie eine Plattform — einen Shop, Ihre Buchhaltung, ein CMS, die Zeiterfassung oder eine Bankverbindung —, geben Sie die Zugangsdaten ein (bei Bankverbindungen erfolgt die Authentifizierung per Weiterleitung) — der Hub verschlüsselt sie, stellt die Verbindung her und ermittelt, welche kanonischen Tools tatsächlich nutzbar sind.",
    },
  },
  {
    title: { en: "Create an agent and set its policy", de: "Einen Agenten anlegen und Richtlinie festlegen" },
    tag: { en: "Agents & Permissions", de: "Agenten & Rechte" },
    body: {
      en: "Give the agent a name, then set Allow, Require approval, or Deny for each tool in the catalog. A rule scoped to one integration always wins over a rule for the tool in general, which always wins over the tool's Hub-wide default.",
      de: "Geben Sie dem Agenten einen Namen und legen Sie für jedes Tool im Katalog Erlauben, Freigabe erforderlich oder Verweigern fest. Eine Regel für eine einzelne Integration hat immer Vorrang vor einer allgemeinen Tool-Regel, die wiederum Vorrang vor der Hub-weiten Standardeinstellung hat.",
    },
  },
  {
    title: { en: "Approve or deny", de: "Genehmigen oder ablehnen" },
    tag: { en: "Approvals Inbox", de: "Freigaben" },
    body: {
      en: "A tool set to Require approval never runs on its own — it lands as a pending card on the Dashboard and in the Approvals inbox, with the exact input the agent supplied. Approve executes it for real, immediately; Deny closes it without ever running it.",
      de: "Ein auf Freigabe erforderlich gesetztes Tool läuft nie von selbst — es erscheint als ausstehende Karte im Dashboard und im Freigabe-Postfach, mit genau den Daten, die der Agent übergeben hat. Genehmigen führt es sofort real aus; Ablehnen schließt die Anfrage, ohne sie je auszuführen.",
    },
  },
  {
    title: { en: "Review the audit log", de: "Das Audit-Log prüfen" },
    tag: { en: "Audit Logs", de: "Protokolle" },
    body: {
      en: "Every gated call is written once, permanently — allowed, denied, sent for approval, or errored — with the platform's own error message when something fails. Filter by tool or status, or export the log as CSV.",
      de: "Jeder geprüfte Aufruf wird einmal und dauerhaft protokolliert — erlaubt, abgelehnt, zur Freigabe geschickt oder fehlgeschlagen —, im Fehlerfall inklusive der Originalmeldung der Plattform. Filtern Sie nach Tool oder Status, oder exportieren Sie das Log als CSV.",
    },
  },
  {
    title: { en: "Manage billing", de: "Abrechnung verwalten" },
    tag: { en: "Billing", de: "Abrechnung" },
    body: {
      en: "Upgrade from Free to Pro through Stripe Checkout, and manage payment details, invoices, or a downgrade at any time through the Billing Portal — both reachable by organization owners and admins.",
      de: "Wechseln Sie über Stripe Checkout von Free zu Pro, und verwalten Sie Zahlungsdaten, Rechnungen oder ein Downgrade jederzeit über das Billing-Portal — beides erreichbar für Owner und Admins der Organisation.",
    },
  },
  {
    title: { en: "Invite your team", de: "Ihr Team einladen" },
    tag: { en: "Team", de: "Team" },
    body: {
      en: "Invite a teammate by email and choose their role. You get back a link to share — there's no dependency on an email actually arriving.",
      de: "Laden Sie ein Teammitglied per E-Mail ein und wählen Sie dessen Rolle. Sie erhalten einen Link zum Teilen zurück — unabhängig davon, ob eine E-Mail tatsächlich zugestellt wird.",
    },
  },
  {
    title: { en: "Export or delete your data", de: "Daten exportieren oder löschen" },
    tag: { en: "My Account", de: "Mein Konto" },
    body: {
      en: "Download everything the Hub holds about you as a file, or permanently delete your account — both with a confirmation step, from My Account.",
      de: "Laden Sie alles, was der Hub über Sie gespeichert hat, als Datei herunter, oder löschen Sie Ihr Konto endgültig — beides mit Bestätigungsschritt, über Mein Konto.",
    },
  },
  {
    title: { en: "Operate the Hub", de: "Den Hub betreiben" },
    tag: { en: "Platform admin only", de: "Nur Plattform-Admin" },
    body: {
      en: "Manage every organization and user, enable or disable a platform or tool Hub-wide, and grant or revoke platform-admin access itself — from a dedicated area separate from any one organization's workspace.",
      de: "Verwalten Sie jede Organisation und jeden Nutzer, aktivieren oder deaktivieren Sie eine Plattform oder ein Tool Hub-weit, und vergeben oder entziehen Sie den Plattform-Admin-Zugriff selbst — in einem eigenen Bereich, getrennt vom Arbeitsbereich einzelner Organisationen.",
    },
  },
];

export type PlatformCard = { id: string; icon: string; color: string; name: string; description: Bi };

export const PLATFORM_CARDS: PlatformCard[] = [
  {
    id: "woocommerce", icon: "storefront", color: "#7F54B3", name: "WooCommerce",
    description: {
      en: "Order search, lookup, and refunds, plus product and inventory tools.",
      de: "Bestellsuche, -abfrage und -erstattungen sowie Produkt- und Lager-Tools.",
    },
  },
  {
    id: "shopware", icon: "inventory_2", color: "#189EFF", name: "Shopware 6",
    description: {
      en: "Order search, lookup, and refunds, plus product and inventory tools, via Shopware's OAuth2 API.",
      de: "Bestellsuche, -abfrage und -erstattungen sowie Produkt- und Lager-Tools über die OAuth2-API von Shopware.",
    },
  },
  {
    id: "shopify", icon: "shopping_bag", color: "#95BF47", name: "Shopify",
    description: {
      en: "Order search, lookup, and refunds, plus product and inventory tools.",
      de: "Bestellsuche, -abfrage und -erstattungen sowie Produkt- und Lager-Tools.",
    },
  },
  {
    id: "magento", icon: "shopping_cart", color: "#EE672F", name: "Magento",
    description: {
      en: "Order search, lookup, and refunds, plus product and inventory tools.",
      de: "Bestellsuche, -abfrage und -erstattungen sowie Produkt- und Lager-Tools.",
    },
  },
  {
    id: "lexoffice", icon: "receipt_long", color: "#6CC24A", name: "Lexoffice",
    description: {
      en: "Invoice and contact search, plus invoice lookup, via Lexoffice's bookkeeping API.",
      de: "Rechnungs- und Kontaktsuche sowie Rechnungsabfrage über die Buchhaltungs-API von Lexoffice.",
    },
  },
  {
    id: "wordpress", icon: "edit_note", color: "#21759B", name: "WordPress",
    description: {
      en: "Page search and lookup via the WordPress REST API, authenticated with an Application Password.",
      de: "Seitensuche und -abfrage über die WordPress-REST-API, authentifiziert mit einem Anwendungspasswort.",
    },
  },
  {
    id: "toggl", icon: "schedule", color: "#E01B84", name: "Toggl Track",
    description: {
      en: "Time entry search and lookup against a Toggl Track workspace.",
      de: "Suche und Abfrage von Zeiteinträgen in einem Toggl-Track-Workspace.",
    },
  },
  {
    id: "gocardless", icon: "account_balance", color: "#191919", name: "GoCardless",
    description: {
      en: "Read-only bank account and transaction access via GoCardless Bank Account Data — connect by authenticating with your bank, no API key needed.",
      de: "Lesender Zugriff auf Bankkonten und Transaktionen über GoCardless Bank Account Data — Verbindung per Bank-Login, kein API-Schlüssel nötig.",
    },
  },
];
