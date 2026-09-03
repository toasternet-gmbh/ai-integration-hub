import type { Bi } from "./platformCatalog";

/** Plain-language, non-developer content for the interactive "try it" demo on the quick-connect
 *  page — one entry per canonical tool name (same keys as `TOOL_INFO` in platformCatalog.ts, but
 *  written for a shop owner deciding whether to trust an AI agent with their store, not a
 *  developer reading an API reference). Every example uses invented sample data — nothing here
 *  calls a real integration, since a visitor hasn't connected one yet at this point in the flow. */
export interface ToolDemo {
  /** Material Symbols icon for this tool's domain. */
  icon: string;
  /** Plain-language action name — what a non-developer would call this, not the dot-path. */
  label: Bi;
  /** One sentence: why a business owner would want an agent to be able to do this. */
  benefit: Bi;
  /** A natural-language question a person might ask their AI agent. */
  agentAsks: Bi;
  /** The Hub's (invented) reply — what the agent would show back, in plain language. */
  hubReplies: Bi;
}

export const TOOL_DEMOS: Record<string, ToolDemo> = {
  "orders.search": {
    icon: "shopping_cart",
    label: { en: "See your orders", de: "Bestellungen einsehen" },
    benefit: {
      en: "Let your agent check what's come in without you opening the store dashboard.",
      de: "Lassen Sie Ihren Agenten nachsehen, was reingekommen ist — ohne das Shop-Dashboard zu öffnen.",
    },
    agentAsks: { en: "Show me orders waiting on my decision.", de: "Zeig mir Bestellungen, die auf meine Entscheidung warten." },
    hubReplies: {
      en: "3 orders need attention: #1042 (pending), #1043 (paid, not shipped), #1044 (refund requested).",
      de: "3 Bestellungen brauchen Aufmerksamkeit: #1042 (ausstehend), #1043 (bezahlt, nicht versandt), #1044 (Rückerstattung angefragt).",
    },
  },
  "orders.get": {
    icon: "shopping_cart",
    label: { en: "Look up one order", de: "Eine Bestellung nachschlagen" },
    benefit: { en: "Get the full details on a single order instantly.", de: "Erhalten Sie sofort alle Details zu einer einzelnen Bestellung." },
    agentAsks: { en: "What's the status of order #1044?", de: "Was ist der Status von Bestellung #1044?" },
    hubReplies: {
      en: "Order #1044 — 2× Blue T-Shirt (M), €38.00, placed 2 days ago, customer requested a refund citing the wrong size.",
      de: "Bestellung #1044 — 2× blaues T-Shirt (M), 38,00 €, vor 2 Tagen aufgegeben, Kunde hat eine Rückerstattung wegen falscher Größe angefragt.",
    },
  },
  "orders.refund": {
    icon: "shopping_cart",
    label: { en: "Refund an order (with your approval)", de: "Bestellung erstatten (mit Ihrer Freigabe)" },
    benefit: {
      en: "Let an agent draft the refund — but nothing happens to your money until you personally approve it.",
      de: "Lassen Sie einen Agenten die Erstattung vorbereiten — an Ihrem Geld ändert sich aber erst etwas, wenn Sie es persönlich freigeben.",
    },
    agentAsks: { en: "Refund order #1044, wrong size was sent.", de: "Erstatte Bestellung #1044, es wurde die falsche Größe verschickt." },
    hubReplies: {
      en: "A €38.00 refund is waiting in your Approvals inbox — nothing is charged until you approve it.",
      de: "Eine Erstattung über 38,00 € wartet in Ihrem Freigabe-Postfach — es wird nichts belastet, bevor Sie zustimmen.",
    },
  },
  "products.search": {
    icon: "inventory_2",
    label: { en: "Browse your products", de: "Produkte durchsuchen" },
    benefit: { en: "An agent can answer \"do we sell X\" without you searching the catalog.", de: "Ein Agent kann „Verkaufen wir X?“ beantworten, ohne dass Sie im Katalog suchen." },
    agentAsks: { en: "Do we sell anything called \"Blue T-Shirt\"?", de: "Verkaufen wir etwas namens „Blaues T-Shirt“?" },
    hubReplies: { en: "Yes — Blue T-Shirt (M/L/XL), €19.00, 42 in stock.", de: "Ja — Blaues T-Shirt (M/L/XL), 19,00 €, 42 auf Lager." },
  },
  "products.get": {
    icon: "inventory_2",
    label: { en: "Look up one product", de: "Ein Produkt nachschlagen" },
    benefit: { en: "Pull full details on one item on demand.", de: "Rufen Sie bei Bedarf alle Details zu einem Artikel ab." },
    agentAsks: { en: "What's the price and SKU for the Blue T-Shirt, size M?", de: "Wie lauten Preis und SKU für das blaue T-Shirt, Größe M?" },
    hubReplies: { en: "Blue T-Shirt (M) — SKU BT-M-BLU, €19.00, 42 in stock.", de: "Blaues T-Shirt (M) — SKU BT-M-BLU, 19,00 €, 42 auf Lager." },
  },
  "products.update_price": {
    icon: "inventory_2",
    label: { en: "Change a price", de: "Preis ändern" },
    benefit: {
      en: "Let an agent update a price for a sale or correction — instantly, no dashboard needed.",
      de: "Lassen Sie einen Agenten einen Preis für einen Sale oder eine Korrektur ändern — sofort, ohne Dashboard.",
    },
    agentAsks: { en: "Put the Blue T-Shirt on sale for €14.99.", de: "Setze das blaue T-Shirt für 14,99 € in den Sale." },
    hubReplies: { en: "Blue T-Shirt (M) price updated: €19.00 → €14.99.", de: "Preis von Blaues T-Shirt (M) aktualisiert: 19,00 € → 14,99 €." },
  },
  "inventory.get_stock": {
    icon: "warehouse",
    label: { en: "Check stock level", de: "Lagerbestand prüfen" },
    benefit: { en: "Know exactly what's left without a walk to the warehouse.", de: "Wissen Sie genau, was noch da ist — ohne Gang ins Lager." },
    agentAsks: { en: "How many Blue T-Shirts (M) do we have left?", de: "Wie viele blaue T-Shirts (M) haben wir noch?" },
    hubReplies: { en: "18 units in stock.", de: "18 Stück auf Lager." },
  },
  "inventory.update_stock": {
    icon: "warehouse",
    label: { en: "Update stock level", de: "Lagerbestand aktualisieren" },
    benefit: { en: "Correct a stock count the moment you know it's wrong.", de: "Korrigieren Sie einen Lagerbestand, sobald Sie wissen, dass er falsch ist." },
    agentAsks: { en: "We just did inventory — set Blue T-Shirt (M) to 25 units.", de: "Wir haben gerade Inventur gemacht — setze blaues T-Shirt (M) auf 25 Stück." },
    hubReplies: { en: "Stock updated: 18 → 25 units.", de: "Bestand aktualisiert: 18 → 25 Stück." },
  },
  "invoices.search": {
    icon: "receipt_long",
    label: { en: "See your invoices", de: "Rechnungen einsehen" },
    benefit: { en: "Ask which invoices are still unpaid without opening your accounting software.", de: "Fragen Sie, welche Rechnungen noch offen sind — ohne Ihre Buchhaltungssoftware zu öffnen." },
    agentAsks: { en: "Which invoices are still open?", de: "Welche Rechnungen sind noch offen?" },
    hubReplies: {
      en: "2 open invoices: #INV-118 (€450, due in 3 days), #INV-121 (€1,200, overdue by 5 days).",
      de: "2 offene Rechnungen: #INV-118 (450 €, fällig in 3 Tagen), #INV-121 (1.200 €, seit 5 Tagen überfällig).",
    },
  },
  "invoices.get": {
    icon: "receipt_long",
    label: { en: "Look up one invoice", de: "Eine Rechnung nachschlagen" },
    benefit: { en: "Pull the full detail on one invoice instantly.", de: "Rufen Sie sofort alle Details zu einer Rechnung ab." },
    agentAsks: { en: "What's on invoice #INV-121?", de: "Was steht auf Rechnung #INV-121?" },
    hubReplies: {
      en: "Invoice #INV-121 — consulting services, March — €1,200, issued to Müller GmbH, due 5 days ago.",
      de: "Rechnung #INV-121 — Beratungsleistungen, März — 1.200 €, ausgestellt an Müller GmbH, seit 5 Tagen fällig.",
    },
  },
  "contacts.search": {
    icon: "group",
    label: { en: "See your contacts", de: "Kontakte einsehen" },
    benefit: { en: "Find a customer, vendor, or lead record without digging through spreadsheets.", de: "Finden Sie einen Kunden-, Lieferanten- oder Lead-Datensatz, ohne Tabellen zu durchsuchen." },
    agentAsks: { en: "Find the contact record for Müller GmbH.", de: "Finde den Kontakt-Datensatz für Müller GmbH." },
    hubReplies: { en: "Müller GmbH — billing contact a.mueller@example.com, 3 invoices on file.", de: "Müller GmbH — Rechnungskontakt a.mueller@example.com, 3 Rechnungen hinterlegt." },
  },
  "contacts.get": {
    icon: "group",
    label: { en: "Look up one contact", de: "Einen Kontakt nachschlagen" },
    benefit: { en: "Pull the full record for one contact instantly.", de: "Rufen Sie sofort den vollständigen Datensatz eines Kontakts ab." },
    agentAsks: { en: "What do we have on file for Müller GmbH?", de: "Was haben wir zu Müller GmbH gespeichert?" },
    hubReplies: { en: "Müller GmbH — customer since 2024, 3 invoices, last contact 2 weeks ago.", de: "Müller GmbH — Kunde seit 2024, 3 Rechnungen, letzter Kontakt vor 2 Wochen." },
  },
  "contacts.create": {
    icon: "group",
    label: { en: "Create a contact", de: "Kontakt erstellen" },
    benefit: { en: "Register a new customer or vendor the moment you meet one — no separate data entry later.", de: "Erfassen Sie einen neuen Kunden oder Lieferanten, sobald Sie ihn kennenlernen — keine spätere Nacherfassung nötig." },
    agentAsks: { en: "Add a new customer: Schmidt Consulting, schmidt@example.com.", de: "Lege einen neuen Kunden an: Schmidt Consulting, schmidt@example.com." },
    hubReplies: { en: "Contact created: Schmidt Consulting.", de: "Kontakt erstellt: Schmidt Consulting." },
  },
  "invoices.create": {
    icon: "receipt_long",
    label: { en: "Create an invoice (with your approval)", de: "Rechnung erstellen (mit Ihrer Freigabe)" },
    benefit: {
      en: "Let an agent draft an invoice from a conversation — but nothing is finalized until you personally approve it.",
      de: "Lassen Sie einen Agenten eine Rechnung aus einem Gespräch heraus vorbereiten — final wird sie erst, wenn Sie persönlich zustimmen.",
    },
    agentAsks: { en: "Invoice Schmidt Consulting for 5 hours of consulting at €120/hour.", de: "Stelle Schmidt Consulting 5 Stunden Beratung zu 120 €/Stunde in Rechnung." },
    hubReplies: {
      en: "A draft invoice for €600.00 is waiting in your Approvals inbox — nothing is sent until you approve it.",
      de: "Ein Rechnungsentwurf über 600,00 € wartet in Ihrem Freigabe-Postfach — es wird nichts versendet, bevor Sie zustimmen.",
    },
  },
  "reports.profit_and_loss": {
    icon: "trending_up",
    label: { en: "Get a profit & loss report", de: "Gewinn-und-Verlust-Bericht abrufen" },
    benefit: { en: "Ask how the business is doing this quarter without waiting for your accountant.", de: "Fragen Sie, wie das Geschäft dieses Quartal läuft, ohne auf Ihren Steuerberater zu warten." },
    agentAsks: { en: "How did we do financially last quarter?", de: "Wie standen wir finanziell im letzten Quartal da?" },
    hubReplies: { en: "Q2: €84,200 revenue, €61,900 expenses, €22,300 profit.", de: "Q2: 84.200 € Umsatz, 61.900 € Ausgaben, 22.300 € Gewinn." },
  },
  "products.create": {
    icon: "inventory_2",
    label: { en: "Create a product (with your approval)", de: "Produkt erstellen (mit Ihrer Freigabe)" },
    benefit: { en: "Add a new billable item the moment you start offering it — no manual catalog entry later.", de: "Fügen Sie einen neuen abrechenbaren Artikel hinzu, sobald Sie ihn anbieten — keine spätere manuelle Erfassung." },
    agentAsks: { en: "Add a new item: \"Onboarding package\", €450 net.", de: "Lege einen neuen Artikel an: „Onboarding-Paket“, 450 € netto." },
    hubReplies: { en: "A new item \"Onboarding package\" (€450.00) is waiting in your Approvals inbox.", de: "Ein neuer Artikel „Onboarding-Paket“ (450,00 €) wartet in Ihrem Freigabe-Postfach." },
  },
  "vouchers.create_from_file": {
    icon: "receipt",
    label: { en: "Book an expense from a receipt (with your approval)", de: "Ausgabe aus Beleg buchen (mit Ihrer Freigabe)" },
    benefit: {
      en: "Snap a photo of a receipt and let an agent book it as an expense — nothing is recorded until you approve it.",
      de: "Machen Sie ein Foto von einem Beleg und lassen Sie einen Agenten ihn als Ausgabe buchen — gebucht wird erst nach Ihrer Freigabe.",
    },
    agentAsks: { en: "Book this taxi receipt as a business expense.", de: "Buche diesen Taxi-Beleg als Geschäftsausgabe." },
    hubReplies: { en: "A new expense voucher from \"taxi-receipt.jpg\" is waiting in your Approvals inbox.", de: "Ein neuer Ausgabenbeleg aus „taxi-receipt.jpg“ wartet in Ihrem Freigabe-Postfach." },
  },
  "cms.pages.search": {
    icon: "article",
    label: { en: "See your website pages", de: "Website-Seiten einsehen" },
    benefit: { en: "Let an agent check what's actually published on your site.", de: "Lassen Sie einen Agenten prüfen, was auf Ihrer Website tatsächlich veröffentlicht ist." },
    agentAsks: { en: "Do we have a page about our shipping policy?", de: "Haben wir eine Seite zu unseren Versandbedingungen?" },
    hubReplies: { en: "Yes — \"Shipping & Returns\", published, last updated 2 months ago.", de: "Ja — „Versand & Rücksendungen“, veröffentlicht, zuletzt vor 2 Monaten aktualisiert." },
  },
  "cms.pages.get": {
    icon: "article",
    label: { en: "Look up one page", de: "Eine Seite nachschlagen" },
    benefit: { en: "Pull the current content of one page on demand.", de: "Rufen Sie bei Bedarf den aktuellen Inhalt einer Seite ab." },
    agentAsks: { en: "What does our shipping policy page currently say?", de: "Was steht aktuell auf unserer Versandbedingungen-Seite?" },
    hubReplies: {
      en: "\"We ship within 2 business days across the EU, free over €50...\" (312 words, last edited by Anna on Aug 12).",
      de: "„Wir versenden EU-weit innerhalb von 2 Werktagen, kostenlos ab 50 €...“ (312 Wörter, zuletzt am 12. Aug. von Anna bearbeitet).",
    },
  },
  "time_entries.search": {
    icon: "schedule",
    label: { en: "See logged time", de: "Erfasste Zeit einsehen" },
    benefit: { en: "Check what's been logged this week without opening the time tracker.", de: "Prüfen Sie, was diese Woche erfasst wurde — ohne die Zeiterfassung zu öffnen." },
    agentAsks: { en: "How many hours were logged on the Acme project this week?", de: "Wie viele Stunden wurden diese Woche für das Projekt Acme erfasst?" },
    hubReplies: { en: "14.5 hours across 3 people this week on Acme.", de: "14,5 Stunden von 3 Personen diese Woche für Acme." },
  },
  "time_entries.get": {
    icon: "schedule",
    label: { en: "Look up one time entry", de: "Einen Zeiteintrag nachschlagen" },
    benefit: { en: "Pull the details of a single logged entry.", de: "Rufen Sie die Details eines einzelnen Zeiteintrags ab." },
    agentAsks: { en: "What was logged on Tuesday for the Acme project?", de: "Was wurde am Dienstag für das Projekt Acme erfasst?" },
    hubReplies: { en: "Tuesday, Acme project — 3h 15m, \"Client call + follow-up notes\", logged by Jonas.", de: "Dienstag, Projekt Acme — 3 Std. 15 Min., „Kundengespräch + Notizen“, erfasst von Jonas." },
  },
  "accounts.list": {
    icon: "account_balance_wallet",
    label: { en: "See your bank accounts", de: "Bankkonten einsehen" },
    benefit: { en: "Get a read-only snapshot of balances without logging into online banking.", de: "Erhalten Sie einen reinen Lese-Überblick über Kontostände, ohne sich ins Online-Banking einzuloggen." },
    agentAsks: { en: "What's our current account balance?", de: "Wie hoch ist unser aktueller Kontostand?" },
    hubReplies: { en: "Business Checking: €18,420.55 (as of this morning).", de: "Geschäftskonto: 18.420,55 € (Stand heute Morgen)." },
  },
  "transactions.search": {
    icon: "swap_horiz",
    label: { en: "See your bank transactions", de: "Banktransaktionen einsehen" },
    benefit: { en: "Ask about recent payments in and out without exporting a statement.", de: "Fragen Sie nach kürzlichen Zahlungen, ohne einen Kontoauszug zu exportieren." },
    agentAsks: { en: "Any payments over €1,000 in the last week?", de: "Gab es letzte Woche Zahlungen über 1.000 €?" },
    hubReplies: {
      en: "2 found: −€1,450.00 (supplier invoice, Tue) and +€3,200.00 (customer payment, Thu).",
      de: "2 gefunden: −1.450,00 € (Lieferantenrechnung, Di) und +3.200,00 € (Kundenzahlung, Do).",
    },
  },
  "deals.search": {
    icon: "handshake",
    label: { en: "See your deals", de: "Deals einsehen" },
    benefit: { en: "Check what's in your sales pipeline without opening the CRM.", de: "Prüfen Sie Ihre Vertriebspipeline, ohne das CRM zu öffnen." },
    agentAsks: { en: "What deals are close to closing this month?", de: "Welche Deals stehen diesen Monat kurz vor Abschluss?" },
    hubReplies: {
      en: "3 deals in \"Negotiation\": Acme Corp (€12,000), Beta LLC (€4,500), Gamma Inc (€8,000).",
      de: "3 Deals in „Verhandlung“: Acme Corp (12.000 €), Beta LLC (4.500 €), Gamma Inc (8.000 €).",
    },
  },
  "deals.get": {
    icon: "handshake",
    label: { en: "Look up one deal", de: "Einen Deal nachschlagen" },
    benefit: { en: "Pull the full detail on one deal instantly.", de: "Rufen Sie sofort alle Details zu einem Deal ab." },
    agentAsks: { en: "What's the status on the Acme Corp deal?", de: "Wie ist der Status beim Deal mit Acme Corp?" },
    hubReplies: {
      en: "Acme Corp — €12,000, stage: Negotiation, last activity 2 days ago, next step: send revised contract.",
      de: "Acme Corp — 12.000 €, Phase: Verhandlung, letzte Aktivität vor 2 Tagen, nächster Schritt: überarbeiteten Vertrag senden.",
    },
  },
};
