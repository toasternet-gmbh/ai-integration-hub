export type HelpCategory = "operations" | "admin" | "developer";

export interface HelpArticle {
  slug: string;
  category: HelpCategory;
  readMins: number;
  title: { en: string; de: string };
  summary: { en: string; de: string };
  body: { en: string[]; de: string[] };
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "understanding-approval-requests",
    category: "operations",
    readMins: 3,
    title: { en: "Understanding approval requests", de: "Freigabeanfragen verstehen" },
    summary: {
      en: "What a card in the Approvals inbox actually means, and what happens when you approve or deny it.",
      de: "Was eine Karte im Freigabe-Postfach bedeutet und was beim Genehmigen oder Ablehnen passiert.",
    },
    body: {
      en: [
        "Every tool an agent can call is assigned a policy: Allow, Deny, or Require approval. `orders.refund` defaults to Require approval for every new agent, because a refund is a real financial action, not a read.",
        "When an agent tries to call a Require-approval tool, the Hub doesn't run it — it records the exact call it wanted to make (tool name, integration, and the input the agent supplied, including any reason text) and puts it in the Approvals inbox as a pending card. The agent gets back `{ approval_required: true, approval_id }` instead of a result.",
        "\"Show technical details\" on a card expands the raw tool name and JSON input the agent sent — useful for spotting a suspicious or malformed request before deciding.",
        "Approve runs the underlying call immediately, for real, against the connected store — there is no separate \"unlock and let the agent retry\" step. Deny simply closes the request; the agent never gets to run it. Both decisions are written permanently to the audit log, including who decided and when.",
      ],
      de: [
        "Jedes Tool, das ein Agent aufrufen kann, hat eine Richtlinie: Erlauben, Verweigern oder Freigabe erforderlich. `orders.refund` ist für jeden neuen Agenten standardmäßig freigabepflichtig, da eine Rückerstattung eine echte finanzielle Aktion ist, kein reiner Lesevorgang.",
        "Versucht ein Agent, ein freigabepflichtiges Tool aufzurufen, führt der Hub es nicht aus — er speichert den genauen gewünschten Aufruf (Tool-Name, Integration und die vom Agenten übergebenen Daten, einschließlich eines Begründungstexts) und legt ihn als ausstehende Karte im Freigabe-Postfach ab. Der Agent erhält stattdessen `{ approval_required: true, approval_id }` zurück.",
        "„Technische Details anzeigen“ auf einer Karte zeigt den rohen Tool-Namen und die JSON-Eingabe des Agenten — nützlich, um eine verdächtige oder fehlerhafte Anfrage vor der Entscheidung zu erkennen.",
        "Genehmigen führt den zugrunde liegenden Aufruf sofort und real gegen den verbundenen Shop aus — es gibt keinen separaten „freischalten und den Agenten erneut versuchen lassen“-Schritt. Ablehnen schließt die Anfrage einfach; der Agent kann sie nie ausführen. Beide Entscheidungen werden dauerhaft im Audit-Log festgehalten, inklusive wer wann entschieden hat.",
      ],
    },
  },
  {
    slug: "dashboard-overview",
    category: "operations",
    readMins: 2,
    title: { en: "Dashboard overview", de: "Dashboard-Überblick" },
    summary: {
      en: "How to read the four stat cards and the two activity columns at a glance.",
      de: "So lesen Sie die vier Kennzahlenkarten und die beiden Aktivitätsspalten auf einen Blick.",
    },
    body: {
      en: [
        "The four cards at the top count, for the current project only: connected integrations, active agents, pending approvals, and errors recorded in the audit log. A non-zero pending-approvals count is the one number worth checking first each session.",
        "\"Recent Activity\" is the last handful of audit log rows — every gated tool call the Policy Engine has seen, whether it was allowed, denied, sent to approval, or failed. \"Action Required\" on the right is the live queue of pending approvals, with Approve/Deny right on the card so you rarely need to open the full Approvals inbox for a quick decision.",
        "Nothing on this page is cached client-side beyond the current load — refresh to see the latest state.",
      ],
      de: [
        "Die vier Karten oben zählen, nur für das aktuelle Projekt: verbundene Integrationen, aktive Agenten, ausstehende Freigaben und im Audit-Log erfasste Fehler. Eine Zahl größer null bei den ausstehenden Freigaben ist der erste Wert, den man jede Sitzung prüfen sollte.",
        "„Letzte Aktivitäten“ zeigt die letzten Audit-Log-Einträge — jeden geprüften Tool-Aufruf, den die Policy Engine gesehen hat, egal ob erlaubt, abgelehnt, zur Freigabe geschickt oder fehlgeschlagen. „Handlung erforderlich“ rechts ist die Live-Warteschlange ausstehender Freigaben, mit Genehmigen/Ablehnen direkt auf der Karte, sodass man selten das vollständige Freigabe-Postfach öffnen muss.",
        "Auf dieser Seite wird nichts über den aktuellen Ladevorgang hinaus zwischengespeichert — aktualisieren Sie die Seite für den neuesten Stand.",
      ],
    },
  },
  {
    slug: "audit-log-basics",
    category: "operations",
    readMins: 3,
    title: { en: "Reading the audit log", de: "Das Audit-Log lesen" },
    summary: {
      en: "The four statuses you'll see, and what a real error row usually means.",
      de: "Die vier Status, die Ihnen begegnen, und was eine echte Fehlerzeile meist bedeutet.",
    },
    body: {
      en: [
        "Every gated tool call writes exactly one row: allowed (ran immediately), denied (blocked by policy), require_approval (parked, waiting on a human), or error (ran but the connected platform rejected it or the request failed).",
        "An error row's Detail column carries the platform's own error message verbatim — for example a WooCommerce order whose payment method doesn't support automatic refunds, or a Magento/Shopify/Shopware order that's already fully refunded. These aren't Hub bugs; they're the underlying store telling you the action genuinely can't happen as requested.",
        "The log is append-only and scoped to the current project. Use the search box to filter by tool name (e.g. `orders.refund`) and the status chips to isolate errors when triaging a specific incident.",
      ],
      de: [
        "Jeder geprüfte Tool-Aufruf schreibt genau eine Zeile: allowed (sofort ausgeführt), denied (durch Richtlinie blockiert), require_approval (wartet auf eine Entscheidung) oder error (ausgeführt, aber von der Plattform abgelehnt oder fehlgeschlagen).",
        "Die Detail-Spalte einer Fehlerzeile enthält die Original-Fehlermeldung der Plattform — etwa eine WooCommerce-Bestellung, deren Zahlungsmethode keine automatischen Rückerstattungen unterstützt, oder eine Magento-/Shopify-/Shopware-Bestellung, die bereits vollständig erstattet wurde. Das sind keine Fehler des Hubs, sondern der zugrunde liegende Shop, der mitteilt, dass die Aktion so tatsächlich nicht möglich ist.",
        "Das Log ist nur anfügbar und auf das aktuelle Projekt beschränkt. Nutzen Sie die Suche, um nach Tool-Namen zu filtern (z. B. `orders.refund`), und die Status-Chips, um Fehler bei der Analyse eines bestimmten Vorfalls zu isolieren.",
      ],
    },
  },
  {
    slug: "connecting-a-store",
    category: "admin",
    readMins: 8,
    title: { en: "Connecting a store", de: "Einen Shop verbinden" },
    summary: {
      en: "Exactly where to generate credentials on each supported platform, and how the Hub verifies the connection.",
      de: "Wo genau Sie auf jeder unterstützten Plattform Zugangsdaten erzeugen und wie der Hub die Verbindung prüft.",
    },
    body: {
      en: [
        "Integrations → Connect a store. Pick a platform, name the connection (anything meaningful, e.g. \"Merch Store\"), and fill in its credential fields as described below. Whichever platform you use, grant write access (not just read) if you ever want `orders.refund` to work — a read-only key connects fine but fails only when a refund is actually attempted.",
        "## WooCommerce",
        "- In WordPress admin: WooCommerce → Settings → Advanced → REST API → Add key.",
        "- Description: anything (e.g. \"AI Integration Hub\"). User: an account with `shop_manager` or Administrator rights. Permissions: **Read/Write** — Read-only blocks `orders.refund` later.",
        "- Click Generate — WooCommerce shows the Consumer Key and Consumer Secret exactly once. Copy both into the Hub immediately; there is no way to view the secret again afterwards (only regenerate it, which invalidates the old pair).",
        "- Store URL is your site's base address (e.g. `https://shop.example.com`) — not the `/wp-json/...` REST path itself, the Hub appends that automatically.",
        "## Shopware 6",
        "- Settings → System → Integrations → Add integration. Name it to match the Hub connection.",
        "- Shopware generates an Access ID (Client ID) and Secret Access Key immediately — copy both now, the secret isn't shown again.",
        "- A freshly created integration has **no ACL role by default** — it will connect and pass \"Connect & test\", then fail on the first real `orders.*` call with \"Missing privilege\". Assign it the Administrator role, or at minimum the `order:read` and `order:write` privileges, under the integration's Permissions tab.",
        "- Store URL is the shop's base domain (e.g. `https://shop.example.com`), not `/api`.",
        "## Shopify",
        "- Shopify admin → Settings → Apps and sales channels → Develop apps → Create an app. Name it, then open Configuration → Admin API integration.",
        "- Under Admin API access scopes, grant at least `read_orders` and `write_orders` (write is required for `orders.refund`; refunds specifically also need `write_orders` — Shopify does not split refunds into a separate scope).",
        "- Install the app on the store, then go to API credentials → reveal the Admin API access token. It's shown once — copy it now.",
        "- Store URL is your `*.myshopify.com` domain, even if the storefront also has a custom domain attached.",
        "## Magento 2",
        "- Admin → System → Extensions → Integrations → Add New Integration.",
        "- Under API, grant Resource Access to at least Sales → Sales → Orders, and Sales → Operations → Credit Memos if you want `orders.refund` to work (a refund in Magento is created as a credit memo).",
        "- Save, then Activate the integration. Magento shows a one-time confirmation screen with the generated Access Token — copy it now; the token itself isn't stored in plaintext by Magento either, so this is your only chance.",
        "- Store URL is the base Magento URL (e.g. `https://shop.example.com`) — the Hub calls the REST API under `/rest/V1` itself.",
        "## Verifying the connection",
        "\"Connect & test\" immediately calls the platform to verify the credentials and discovers which canonical tools it supports (`orders.search`/`orders.get`/`orders.refund` today). A failure shows the platform's own error message — a wrong URL and a wrong secret produce different, specific errors, not a generic \"failed\". See \"Troubleshooting a failed store connection\" for what the common ones mean.",
        "Credentials are encrypted at rest and are never returned by any API response after the initial connect — not even to an admin. If you need to rotate a key, remove and re-add the integration with a freshly generated credential from the platform.",
      ],
      de: [
        "Integrationen → Shop verbinden. Plattform wählen, der Verbindung einen aussagekräftigen Namen geben (z. B. „Merch Store“) und die unten beschriebenen Zugangsdaten eintragen. Vergeben Sie auf jeder Plattform Schreibrechte (nicht nur Lesen), wenn `orders.refund` funktionieren soll — ein reiner Lese-Schlüssel verbindet sich problemlos und scheitert erst, wenn tatsächlich eine Rückerstattung versucht wird.",
        "## WooCommerce",
        "- In der WordPress-Verwaltung: WooCommerce → Einstellungen → Erweitert → REST-API → Schlüssel hinzufügen.",
        "- Beschreibung: beliebig (z. B. „AI Integration Hub“). Benutzer: ein Konto mit `shop_manager`- oder Administrator-Rechten. Berechtigungen: **Lesen/Schreiben** — nur Lesen blockiert später `orders.refund`.",
        "- Auf Generieren klicken — WooCommerce zeigt Consumer Key und Consumer Secret genau einmal an. Beide sofort in den Hub kopieren; das Secret lässt sich danach nicht erneut anzeigen (nur neu generieren, wodurch das alte Paar ungültig wird).",
        "- Die Shop-URL ist die Basis-Adresse Ihrer Seite (z. B. `https://shop.example.com`) — nicht der `/wp-json/...`-REST-Pfad selbst, den hängt der Hub automatisch an.",
        "## Shopware 6",
        "- Einstellungen → System → Integrationen → Integration hinzufügen. Name passend zur Hub-Verbindung vergeben.",
        "- Shopware erzeugt sofort eine Access-ID (Client-ID) und einen Secret Access Key — beide jetzt kopieren, das Secret wird nicht erneut angezeigt.",
        "- Eine frisch erstellte Integration hat **standardmäßig keine ACL-Rolle** — sie verbindet sich und besteht „Verbinden & testen“, scheitert dann aber beim ersten echten `orders.*`-Aufruf mit „Missing privilege“. Weisen Sie ihr im Reiter Berechtigungen die Administrator-Rolle oder mindestens die Rechte `order:read` und `order:write` zu.",
        "- Die Shop-URL ist die Basis-Domain des Shops (z. B. `https://shop.example.com`), nicht `/api`.",
        "## Shopify",
        "- Shopify-Verwaltung → Einstellungen → Apps und Vertriebskanäle → Apps entwickeln → App erstellen. Benennen, dann Konfiguration → Admin-API-Integration öffnen.",
        "- Unter Admin-API-Zugriffsbereiche mindestens `read_orders` und `write_orders` gewähren (Schreiben ist für `orders.refund` erforderlich — Shopify hat für Rückerstattungen keinen eigenen Berechtigungsbereich).",
        "- Die App im Shop installieren, dann unter API-Anmeldedaten das Admin-API-Zugriffstoken einblenden. Es wird nur einmal angezeigt — jetzt kopieren.",
        "- Die Shop-URL ist Ihre `*.myshopify.com`-Domain, auch wenn zusätzlich eine eigene Domain verbunden ist.",
        "## Magento 2",
        "- Verwaltung → System → Erweiterungen → Integrationen → Neue Integration hinzufügen.",
        "- Unter API mindestens Ressourcenzugriff auf Sales → Sales → Orders gewähren, sowie Sales → Operations → Credit Memos, falls `orders.refund` funktionieren soll (eine Rückerstattung wird in Magento als Gutschrift/Credit Memo angelegt).",
        "- Speichern, dann die Integration aktivieren. Magento zeigt einmalig einen Bestätigungsbildschirm mit dem generierten Access Token — jetzt kopieren; auch Magento speichert das Token selbst nicht im Klartext, dies ist die einzige Gelegenheit.",
        "- Die Shop-URL ist die Basis-URL von Magento (z. B. `https://shop.example.com`) — den REST-API-Pfad `/rest/V1` hängt der Hub selbst an.",
        "## Verbindung prüfen",
        "„Verbinden & testen“ ruft die Plattform sofort auf, um die Zugangsdaten zu prüfen und die unterstützten kanonischen Tools zu ermitteln (aktuell `orders.search`/`orders.get`/`orders.refund`). Ein Fehlschlag zeigt die Originalfehlermeldung der Plattform — eine falsche URL und ein falsches Secret erzeugen unterschiedliche, konkrete Fehler statt eines generischen „fehlgeschlagen“. Was die häufigsten bedeuten, steht unter „Fehlerhafte Shop-Verbindung beheben“.",
        "Zugangsdaten werden verschlüsselt gespeichert und nach dem ersten Verbinden von keiner API-Antwort mehr zurückgegeben — auch nicht an einen Administrator. Zum Rotieren eines Schlüssels die Integration entfernen und mit einem frisch erzeugten Zugangsdatensatz der Plattform neu anlegen.",
      ],
    },
  },
  {
    slug: "setting-tool-permissions",
    category: "admin",
    readMins: 3,
    title: { en: "Setting tool permissions", de: "Tool-Rechte festlegen" },
    summary: {
      en: "How the permission matrix resolves when an agent has both a specific and a wildcard rule.",
      de: "Wie die Rechte-Matrix entscheidet, wenn ein Agent sowohl eine spezifische als auch eine allgemeine Regel hat.",
    },
    body: {
      en: [
        "Agents & Permissions → select an agent → the matrix lists the canonical tools as rows, with a 3-way Allow / Require approval / Deny control per row.",
        "A rule can target one specific integration, or apply to \"all integrations\" (the wildcard). When an agent calls a tool, the Hub resolves the most specific rule first: an (agent, tool, this exact integration) rule wins over an (agent, tool, all integrations) rule, which wins over the tool's own registry default.",
        "New agents get sensible defaults out of the box — `orders.get`/`orders.search` allowed, `orders.refund` require_approval — without you setting anything. You only need this page to override those defaults, e.g. to explicitly Deny `orders.refund` for an agent you don't trust with refunds at all, or to Allow it outright for one you've fully vetted.",
      ],
      de: [
        "Agenten & Rechte → einen Agenten auswählen → die Matrix listet die kanonischen Tools als Zeilen, mit einer Dreifach-Kontrolle Erlauben / Freigabe erforderlich / Verweigern pro Zeile.",
        "Eine Regel kann eine bestimmte Integration betreffen oder für „alle Integrationen“ gelten (Platzhalter). Ruft ein Agent ein Tool auf, wertet der Hub zuerst die spezifischste Regel aus: eine Regel für (Agent, Tool, genau diese Integration) gewinnt gegenüber einer für (Agent, Tool, alle Integrationen), die wiederum gegenüber dem Standardwert des Tools gewinnt.",
        "Neue Agenten erhalten von Haus aus sinnvolle Standardwerte — `orders.get`/`orders.search` erlaubt, `orders.refund` freigabepflichtig — ohne dass Sie etwas einstellen müssen. Diese Seite brauchen Sie nur, um diese Standardwerte zu überschreiben, z. B. um `orders.refund` für einen Agenten, dem Sie Rückerstattungen gar nicht zutrauen, explizit zu verweigern, oder um es für einen vollständig geprüften Agenten uneingeschränkt zu erlauben.",
      ],
    },
  },
  {
    slug: "creating-agents",
    category: "admin",
    readMins: 2,
    title: { en: "Creating agent profiles", de: "Agentenprofile erstellen" },
    summary: {
      en: "What an \"agent\" is in the Hub, and why every tool call needs to name one.",
      de: "Was ein „Agent“ im Hub ist und warum jeder Tool-Aufruf einen benennen muss.",
    },
    body: {
      en: [
        "An agent is a named identity for one AI system or automation that's allowed to act on this project — for example \"Merch Support Agent\" for a customer-service bot, or a separate agent per environment (staging vs. production) if you want different permissions for each.",
        "Agents & Permissions → New agent, give it a name. It starts Active with the tool-registry defaults (see \"Setting tool permissions\"). Every call into the Hub's MCP gateway must carry an `X-Agent-Id` header identifying which agent is acting — there's no \"anonymous\" tool call, so every audit log row and every approval card can always be traced back to a specific agent.",
        "Disabling an agent (not yet exposed in this UI — ask an admin to do it via the API) blocks every call it makes, regardless of its individual tool permissions.",
      ],
      de: [
        "Ein Agent ist eine benannte Identität für ein KI-System oder eine Automatisierung, die in diesem Projekt handeln darf — zum Beispiel „Merch Support Agent“ für einen Kundenservice-Bot, oder ein eigener Agent pro Umgebung (Staging vs. Produktion), falls unterschiedliche Rechte gewünscht sind.",
        "Agenten & Rechte → Neuer Agent, einen Namen vergeben. Er startet aktiv mit den Standardrechten aus dem Tool-Register (siehe „Tool-Rechte festlegen“). Jeder Aufruf an das MCP-Gateway des Hubs muss einen `X-Agent-Id`-Header mit der handelnden Agent-ID enthalten — es gibt keinen „anonymen“ Tool-Aufruf, sodass jede Audit-Log-Zeile und jede Freigabekarte immer einem bestimmten Agenten zugeordnet werden kann.",
        "Das Deaktivieren eines Agenten (in dieser Oberfläche noch nicht verfügbar — ein Administrator kann dies über die API tun) blockiert jeden seiner Aufrufe, unabhängig von den einzelnen Tool-Rechten.",
      ],
    },
  },
  {
    slug: "authentication-guide",
    category: "developer",
    readMins: 3,
    title: { en: "Authentication", de: "Authentifizierung" },
    summary: {
      en: "The two ways to call the Hub's MCP gateway, and when to use each.",
      de: "Die zwei Wege, das MCP-Gateway des Hubs aufzurufen, und wann welcher passt.",
    },
    body: {
      en: [
        "The MCP gateway accepts two kinds of Authorization: Bearer token. An API key (starts with `hub_`, from the API Keys page) is already scoped to one project — use this from a server-side agent or script. A Supabase user JWT (from signing in) also works, but you must additionally pass `project_id` in the JSON-RPC params, since a human user can belong to more than one project.",
        "Every `orders.*` call also needs an `X-Agent-Id` header naming which agent is acting — this is separate from the API key/JWT, which only proves who or what is calling, not on whose behalf.",
        "Two bootstrap tools (`create_organization`, `create_project`) work with just a signed-in user's JWT and no project_id — everything else requires one.",
      ],
      de: [
        "Das MCP-Gateway akzeptiert zwei Arten von Authorization: Bearer-Token. Ein API-Schlüssel (beginnt mit `hub_`, aus der Seite API-Schlüssel) ist bereits auf ein Projekt beschränkt — nutzen Sie diesen für einen serverseitigen Agenten oder ein Skript. Ein Supabase-Benutzer-JWT (nach dem Anmelden) funktioniert ebenfalls, aber Sie müssen zusätzlich `project_id` in den JSON-RPC-Parametern übergeben, da ein Benutzer zu mehreren Projekten gehören kann.",
        "Jeder `orders.*`-Aufruf benötigt außerdem einen `X-Agent-Id`-Header, der den handelnden Agenten benennt — das ist unabhängig vom API-Schlüssel/JWT, der nur belegt, wer oder was aufruft, nicht in wessen Auftrag.",
        "Zwei Bootstrap-Tools (`create_organization`, `create_project`) funktionieren bereits mit dem JWT eines angemeldeten Benutzers ohne project_id — alles andere benötigt eines.",
      ],
    },
  },
  {
    slug: "handling-require-approval",
    category: "developer",
    readMins: 3,
    title: { en: "Handling a require_approval response", de: "Umgang mit einer require_approval-Antwort" },
    summary: {
      en: "What your agent's code should do when a tool call comes back parked instead of executed.",
      de: "Was der Code Ihres Agenten tun sollte, wenn ein Tool-Aufruf pausiert statt ausgeführt zurückkommt.",
    },
    body: {
      en: [
        "A gated tool call never fails silently and never blocks waiting for a human — it returns immediately with `{ approval_required: true, approval_id }` instead of the tool's normal result. Your agent's code needs to branch on this shape explicitly; treating it as an error, or as the real result, are both wrong.",
        "The correct pattern is to tell the end user (or the LLM's own reasoning) that the action needs human sign-off, and stop — don't retry the same call expecting a different outcome, and don't poll `list_approvals` in a tight loop. If your product needs to know the outcome, poll `list_approvals` for that `approval_id`'s status at a reasonable interval, or check `list_audit_logs` once the decision is likely made.",
        "Once approved, the action has already run for real by the time anyone sees `status: executed` — there's no further step your agent needs to take.",
      ],
      de: [
        "Ein geprüfter Tool-Aufruf schlägt nie stillschweigend fehl und blockiert nie wartend auf einen Menschen — er liefert sofort `{ approval_required: true, approval_id }` statt des normalen Tool-Ergebnisses zurück. Der Code Ihres Agenten muss explizit auf diese Form reagieren; sie als Fehler oder als tatsächliches Ergebnis zu behandeln, ist beides falsch.",
        "Das richtige Muster: dem Endnutzer (oder dem eigenen Denkprozess des LLM) mitteilen, dass die Aktion eine menschliche Freigabe benötigt, und dann aufhören — nicht denselben Aufruf mit der Erwartung eines anderen Ergebnisses wiederholen und nicht `list_approvals` in einer engen Schleife abfragen. Falls Ihr Produkt das Ergebnis kennen muss, fragen Sie `list_approvals` für diese `approval_id` in sinnvollen Abständen ab, oder prüfen Sie `list_audit_logs`, sobald die Entscheidung wahrscheinlich gefallen ist.",
        "Nach der Genehmigung ist die Aktion bereits real ausgeführt, sobald `status: executed` sichtbar wird — Ihr Agent muss nichts weiter tun.",
      ],
    },
  },
  {
    slug: "api-keys-and-sdk",
    category: "developer",
    readMins: 2,
    title: { en: "API keys and the Node.js client", de: "API-Schlüssel und der Node.js-Client" },
    summary: {
      en: "Creating a key, and the shape of a minimal client call.",
      de: "Einen Schlüssel erstellen und die Struktur eines minimalen Client-Aufrufs.",
    },
    body: {
      en: [
        "API Keys → Create API key, name it for where it'll live (e.g. \"Production Hub Key\"). The full secret is shown exactly once, immediately after creation — copy it now. From then on the page only ever shows a masked suffix; there is no way to recover a lost key, only revoke it and create a new one.",
        "A key is scoped to one project and authenticates as that project, not as any particular agent — pair it with an `X-Agent-Id` header per call to say which agent is acting.",
        "The Quick Start panel on that page shows a minimal working call using the official JS/TS client, `@ai-integration/hub` — copy it as a starting point for your own integration. It's not on the public npm registry yet; install it straight from the repo (`npm install github:toasternet-gmbh/ai-integration-hub#path:sdk`) until it is. Full usage docs, including the `require_approval` handling pattern, are in the package's own README.",
      ],
      de: [
        "API-Schlüssel → API-Schlüssel erstellen, benennen Sie ihn nach seinem Einsatzort (z. B. „Produktionsschlüssel“). Der vollständige geheime Wert wird nur einmal direkt nach der Erstellung angezeigt — jetzt kopieren. Danach zeigt die Seite nur noch ein maskiertes Suffix; ein verlorener Schlüssel lässt sich nicht wiederherstellen, nur widerrufen und neu erstellen.",
        "Ein Schlüssel ist auf ein Projekt beschränkt und authentifiziert als dieses Projekt, nicht als ein bestimmter Agent — kombinieren Sie ihn pro Aufruf mit einem `X-Agent-Id`-Header, um den handelnden Agenten anzugeben.",
        "Das Schnellstart-Panel auf dieser Seite zeigt einen minimalen funktionierenden Aufruf mit dem offiziellen JS/TS-Client `@ai-integration/hub` — als Ausgangspunkt für Ihre eigene Integration kopierbar. Er ist noch nicht im öffentlichen npm-Registry; installieren Sie ihn bis dahin direkt aus dem Repo (`npm install github:toasternet-gmbh/ai-integration-hub#path:sdk`). Vollständige Nutzungsdokumentation, einschließlich des Umgangs mit `require_approval`, steht im README des Pakets.",
      ],
    },
  },
  {
    slug: "how-to-rotate-api-keys",
    category: "developer",
    readMins: 2,
    title: { en: "How to rotate an API key safely", de: "API-Schlüssel sicher rotieren" },
    summary: {
      en: "There's no in-place rotation — here's the safe overlap sequence instead.",
      de: "Es gibt keine Rotation an Ort und Stelle — hier ist die sichere Überlappungs-Reihenfolge." },
    body: {
      en: [
        "The Hub never stores or re-displays a key's plaintext, so \"rotating\" means create-then-revoke, not edit-in-place. Doing it in the wrong order causes a real outage for whatever is using the old key.",
        "Safe sequence: create the new key first, deploy it to whatever service uses it and confirm it's actually calling with the new key (check `last_used_at` on the new key moves, and stays frozen on the old one), then revoke the old key. Revoking a key immediately invalidates every request using it — there's no grace period.",
        "If a key may have leaked (committed to a repo, pasted somewhere public), revoke it immediately even without a replacement ready — a service failing closed is better than a leaked key with live refund access.",
      ],
      de: [
        "Der Hub speichert oder zeigt den Klartext eines Schlüssels nie erneut an, daher bedeutet „Rotieren“ Erstellen-dann-Widerrufen statt Bearbeiten an Ort und Stelle. In der falschen Reihenfolge führt das zu einem echten Ausfall für alles, was den alten Schlüssel nutzt.",
        "Sichere Reihenfolge: zuerst den neuen Schlüssel erstellen, ihn im nutzenden Dienst hinterlegen und bestätigen, dass tatsächlich mit dem neuen Schlüssel aufgerufen wird (prüfen, dass sich `last_used_at` beim neuen Schlüssel ändert und beim alten einfriert), dann erst den alten Schlüssel widerrufen. Ein Widerruf macht jede Anfrage mit diesem Schlüssel sofort ungültig — es gibt keine Übergangsfrist.",
        "Besteht der Verdacht, ein Schlüssel sei durchgesickert (in ein Repo committet, irgendwo öffentlich gepostet), sofort widerrufen, auch ohne fertigen Ersatz — ein fehlschlagender Dienst ist besser als ein durchgesickerter Schlüssel mit aktivem Rückerstattungszugriff.",
      ],
    },
  },
  {
    slug: "troubleshooting-a-failed-connection",
    category: "admin",
    readMins: 3,
    title: { en: "Troubleshooting a failed store connection", de: "Fehlerhafte Shop-Verbindung beheben" },
    summary: {
      en: "Reading the specific error \"Connect & test\" gives you instead of guessing.",
      de: "Die konkrete Fehlermeldung von „Verbinden & testen“ richtig lesen, statt zu raten." },
    body: {
      en: [
        "\"Connect & test\" surfaces the platform's own error text, which is almost always specific enough to act on directly: a DNS/connection failure means the store URL is wrong or the store isn't reachable from wherever the Hub's edge functions run (a `localhost` URL only works if the Hub itself is on the same machine — use a public or tunnel URL for anything else). An auth error (401/403) means the key/secret/token is wrong, revoked, or lacks the required scope.",
        "For Shopware specifically: a freshly created Integration has no ACL role by default and will connect but fail on the first real `orders.*` call with \"Missing privilege\" — grant it an admin role or the specific `order:read`/`order:write` privileges in Settings → System → Integrations → Permissions.",
        "An integration already marked `error` in the list can be re-tested any time via its \"Test connection\" button — it doesn't need to be deleted and recreated unless the credentials themselves changed.",
      ],
      de: [
        "„Verbinden & testen“ zeigt die Originalfehlermeldung der Plattform, die fast immer konkret genug ist, um direkt zu handeln: Ein DNS-/Verbindungsfehler bedeutet, die Shop-URL ist falsch oder der Shop ist von dort, wo die Edge-Functions des Hubs laufen, nicht erreichbar (eine `localhost`-URL funktioniert nur, wenn der Hub selbst auf derselben Maschine läuft — sonst eine öffentliche URL oder einen Tunnel verwenden). Ein Auth-Fehler (401/403) bedeutet, Schlüssel/Secret/Token ist falsch, widerrufen oder hat nicht den nötigen Umfang.",
        "Speziell für Shopware: Eine frisch erstellte Integration hat standardmäßig keine ACL-Rolle und verbindet sich zwar, scheitert aber beim ersten echten `orders.*`-Aufruf mit „Missing privilege“ — eine Admin-Rolle oder die konkreten `order:read`/`order:write`-Rechte unter Einstellungen → System → Integrationen → Berechtigungen zuweisen.",
        "Eine in der Liste bereits als `error` markierte Integration lässt sich jederzeit über „Verbindung testen“ erneut prüfen — ein Löschen und Neuanlegen ist nur nötig, wenn sich die Zugangsdaten selbst geändert haben.",
      ],
    },
  },
  {
    slug: "policy-engine-basics",
    category: "operations",
    readMins: 3,
    title: { en: "How the Policy Engine decides", de: "Wie die Policy Engine entscheidet" },
    summary: {
      en: "The exact order of precedence behind every Allow/Deny/Require-approval decision.",
      de: "Die genaue Rangfolge hinter jeder Erlauben/Verweigern/Freigabe-Entscheidung." },
    body: {
      en: [
        "Every call to a canonical tool (currently the `orders.*` family) is resolved in this order, most specific first: a rule for (this exact agent, this exact tool, this exact integration); then a rule for (this agent, this tool, all integrations); then the tool's own registry default. The first match wins — nothing is additive or averaged.",
        "This is why `orders.refund` defaults to Require approval for every agent out of the box (it's the tool registry's default, before any admin sets an explicit rule), while `orders.get`/`orders.search` default to Allow.",
        "The decision, and everything about the call that led to it, is written to the audit log unconditionally — Allow decisions are logged too, not just the interesting Deny/Require-approval ones, so the log is a complete record, not just an exception list.",
      ],
      de: [
        "Jeder Aufruf eines kanonischen Tools (derzeit die `orders.*`-Familie) wird in dieser Reihenfolge aufgelöst, spezifischste Regel zuerst: eine Regel für (genau dieser Agent, genau dieses Tool, genau diese Integration); dann eine Regel für (dieser Agent, dieses Tool, alle Integrationen); dann der Standardwert im Tool-Register selbst. Der erste Treffer gewinnt — nichts wird addiert oder gemittelt.",
        "Deshalb ist `orders.refund` für jeden Agenten von Haus aus freigabepflichtig (das ist der Standardwert im Tool-Register, bevor ein Administrator eine explizite Regel setzt), während `orders.get`/`orders.search` standardmäßig erlaubt sind.",
        "Die Entscheidung und alles zum jeweiligen Aufruf wird bedingungslos ins Audit-Log geschrieben — auch Erlauben-Entscheidungen, nicht nur die interessanten Verweigern-/Freigabe-Fälle, sodass das Log ein vollständiges Protokoll ist, keine reine Ausnahmeliste.",
      ],
    },
  },
  {
    slug: "getting-started-with-ai-integration-hub",
    category: "admin",
    readMins: 5,
    title: { en: "Getting started with AI Integration Hub", de: "Erste Schritte mit AI Integration Hub" },
    summary: {
      en: "The five steps from a fresh account to a working, gated agent.",
      de: "Die fünf Schritte von einem neuen Konto zu einem funktionierenden, kontrollierten Agenten." },
    body: {
      en: [
        "1. Sign up, then Onboarding creates your Organization (the company-level boundary) and a first Project inside it (one product's integrations/agents/approvals — most teams only ever need one).",
        "2. Integrations → Connect a store for each commerce platform an agent should touch. Each one is tested immediately on connect.",
        "3. Agents & Permissions → New agent for each distinct AI system that should be able to act. Leave the defaults unless you have a specific reason to change them.",
        "4. Generate an API key on the API Keys page and wire it into your agent's code alongside an `X-Agent-Id` header for that agent.",
        "5. Call `orders.get`/`orders.search` to read, and expect `orders.refund` to come back `require_approval` — that's correct, not a bug. Approve it from the Approvals inbox to see the real refund land on the connected store.",
        "From here, Audit Logs is where you go to answer \"what did this agent actually do, and when.\"",
      ],
      de: [
        "1. Registrieren, dann legt die Einrichtung Ihre Organisation an (die Ebene des Unternehmens) und darin ein erstes Projekt (Integrationen/Agenten/Freigaben eines Produkts — die meisten Teams brauchen nur eines).",
        "2. Integrationen → Shop verbinden für jede Commerce-Plattform, mit der ein Agent interagieren soll. Jede wird beim Verbinden sofort getestet.",
        "3. Agenten & Rechte → Neuer Agent für jedes eigenständige KI-System, das handeln soll. Die Standardwerte belassen, außer es gibt einen konkreten Grund, sie zu ändern.",
        "4. Einen API-Schlüssel auf der Seite API-Schlüssel erstellen und im Code des Agenten zusammen mit einem `X-Agent-Id`-Header für diesen Agenten hinterlegen.",
        "5. `orders.get`/`orders.search` zum Lesen aufrufen, und erwarten, dass `orders.refund` mit `require_approval` zurückkommt — das ist korrekt, kein Fehler. Im Freigabe-Postfach genehmigen, um die echte Rückerstattung im verbundenen Shop zu sehen.",
        "Von hier aus sind die Audit-Protokolle die Anlaufstelle für die Frage „Was hat dieser Agent tatsächlich getan, und wann.“",
      ],
    },
  },
];

export function findArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export const CATEGORY_ORDER: HelpCategory[] = ["operations", "admin", "developer"];

export const CATEGORY_LABEL: Record<HelpCategory, { en: string; de: string }> = {
  operations: { en: "OPERATIONS", de: "BETRIEB" },
  admin: { en: "ADMIN", de: "ADMIN" },
  developer: { en: "DEVELOPER", de: "ENTWICKLUNG" },
};
