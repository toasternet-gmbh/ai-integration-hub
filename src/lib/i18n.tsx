import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "de";

// Exported (only) so tests can assert every key has real, non-empty strings in both languages —
// not part of the app's runtime API, use t()/useI18n() for that.
export const STRINGS: Record<string, { en: string; de: string }> = {
  // Nav rail
  "nav.dashboard": { en: "Dashboard", de: "Übersicht" },
  "nav.integrations": { en: "Integrations", de: "Integrationen" },
  "nav.agents": { en: "Agents & Permissions", de: "Agenten & Rechte" },
  "nav.approvals": { en: "Approvals Inbox", de: "Freigaben" },
  "nav.audit": { en: "Audit Logs", de: "Protokolle" },
  "nav.apiKeys": { en: "API Keys", de: "API-Schlüssel" },
  "nav.team": { en: "Team", de: "Team" },
  "nav.account": { en: "My Account", de: "Mein Konto" },
  "nav.help": { en: "Help Center", de: "Hilfe-Center" },
  // Topbar
  "topbar.signOut": { en: "Sign out", de: "Abmelden" },
  "topbar.switchProject": { en: "Switch project", de: "Projekt wechseln" },
  // Common actions
  "action.approve": { en: "Approve", de: "Genehmigen" },
  "action.deny": { en: "Deny", de: "Ablehnen" },
  "action.save": { en: "Save", de: "Speichern" },
  "action.cancel": { en: "Cancel", de: "Abbrechen" },
  "action.create": { en: "Create", de: "Erstellen" },
  "action.connect": { en: "Connect & test", de: "Verbinden & testen" },
  "action.testConnection": { en: "Test connection", de: "Verbindung testen" },
  "action.delete": { en: "Delete", de: "Löschen" },
  "action.continue": { en: "Continue", de: "Weiter" },
  "action.back": { en: "Back", de: "Zurück" },
  "status.allow": { en: "Allow", de: "Erlauben" },
  "status.deny": { en: "Deny", de: "Verweigern" },
  "status.requireApproval": { en: "Require approval", de: "Freigabe nötig" },
  "status.connected": { en: "Connected", de: "Verbunden" },
  "status.pending": { en: "Pending", de: "Ausstehend" },
  "status.active": { en: "Active", de: "Aktiv" },
  "status.inactive": { en: "Inactive", de: "Inaktiv" },
  "status.success": { en: "Success", de: "Erfolgreich" },
  "status.error": { en: "Error", de: "Fehler" },
  // Sign in
  "signin.title": { en: "Access Control", de: "Zugriffskontrolle" },
  "signin.subtitle": { en: "Enter your credentials to manage operations.", de: "Melden Sie sich an, um Vorgänge zu verwalten." },
  "signin.tab.signin": { en: "Sign in", de: "Anmelden" },
  "signin.tab.signup": { en: "Create account", de: "Konto erstellen" },
  "signin.email": { en: "Email address", de: "E-Mail-Adresse" },
  "signin.password": { en: "Password", de: "Passwort" },
  "signin.submit": { en: "Authenticate", de: "Anmelden" },
  "signin.forgotLink": { en: "Forgot password?", de: "Passwort vergessen?" },
  "signin.forgot.title": { en: "Reset password", de: "Passwort zurücksetzen" },
  "signin.forgot.subtitle": { en: "Enter your email and we'll send you a reset link.", de: "Geben Sie Ihre E-Mail-Adresse ein — wir senden Ihnen einen Link zum Zurücksetzen." },
  "signin.forgot.submit": { en: "Send reset link", de: "Link senden" },
  "signin.forgot.sent": { en: "If an account exists for that email, a reset link is on its way.", de: "Falls ein Konto mit dieser E-Mail existiert, ist ein Link zum Zurücksetzen unterwegs." },
  "signin.agreePrefix": { en: "By creating an account, you agree to our", de: "Mit der Kontoerstellung stimmen Sie unseren" },
  "signin.agreeAnd": { en: "and", de: "und unserer" },
  // Reset password
  "resetPassword.title": { en: "Set a new password", de: "Neues Passwort festlegen" },
  "resetPassword.invalidLink": { en: "This reset link is invalid or has expired. Request a new one from the sign-in page.", de: "Dieser Link ist ungültig oder abgelaufen. Fordern Sie einen neuen über die Anmeldeseite an." },
  "resetPassword.newPassword": { en: "New password", de: "Neues Passwort" },
  "resetPassword.confirmPassword": { en: "Confirm password", de: "Passwort bestätigen" },
  "resetPassword.tooShort": { en: "Password must be at least 6 characters.", de: "Das Passwort muss mindestens 6 Zeichen lang sein." },
  "resetPassword.mismatch": { en: "Passwords do not match.", de: "Die Passwörter stimmen nicht überein." },
  "resetPassword.submit": { en: "Update password", de: "Passwort aktualisieren" },
  "resetPassword.success": { en: "Password updated — taking you to your dashboard…", de: "Passwort aktualisiert — Sie werden weitergeleitet …" },
  "resetPassword.backToSignIn": { en: "Back to sign in", de: "Zurück zur Anmeldung" },
  // Onboarding
  "onboarding.eyebrow": { en: "Onboarding sequence", de: "Einrichtung" },
  "onboarding.title": { en: "Setup workspace", de: "Arbeitsbereich einrichten" },
  "onboarding.org.title": { en: "Define organization", de: "Organisation anlegen" },
  "onboarding.org.body": { en: "This is your company — the top-level boundary that owns every project.", de: "Dies ist Ihr Unternehmen — die oberste Ebene, der alle Projekte gehören." },
  "onboarding.org.label": { en: "Organization name", de: "Name der Organisation" },
  "onboarding.project.title": { en: "Initialize project", de: "Projekt anlegen" },
  "onboarding.project.body": { en: "A project groups one product's integrations, agents, and approvals.", de: "Ein Projekt fasst Integrationen, Agenten und Freigaben eines Produkts zusammen." },
  "onboarding.project.label": { en: "Project name", de: "Projektname" },
  "onboarding.project.create": { en: "Create project", de: "Projekt erstellen" },
  // Dashboard
  "dashboard.title": { en: "System Overview", de: "Systemübersicht" },
  "dashboard.subtitle": { en: "Real-time status of integrations, active agents, and pending tasks.", de: "Live-Status der Integrationen, aktiven Agenten und ausstehenden Aufgaben." },
  "dashboard.stat.integrations": { en: "Connected", de: "Verbunden" },
  "dashboard.stat.agents": { en: "Active", de: "Aktiv" },
  "dashboard.stat.approvals": { en: "Pending action", de: "Wartet auf Entscheidung" },
  "dashboard.stat.errors": { en: "Recorded today", de: "Heute erfasst" },
  "dashboard.recentActivity": { en: "Recent Activity", de: "Letzte Aktivitäten" },
  "dashboard.actionRequired": { en: "Action Required", de: "Handlung erforderlich" },
  "dashboard.nothingPending": { en: "Nothing pending — all clear.", de: "Nichts ausstehend — alles erledigt." },
  // Integrations
  "integrations.title": { en: "Integrations", de: "Integrationen" },
  "integrations.subtitle": { en: "Manage external data sources and e-commerce platforms.", de: "Verwalten Sie externe Datenquellen und E-Commerce-Plattformen." },
  "integrations.connectStore": { en: "Connect a store", de: "Shop verbinden" },
  "integrations.selectPlatform": { en: "Select platform", de: "Plattform wählen" },
  "integrations.storeUrl": { en: "Store URL", de: "Shop-URL" },
  "integrations.name": { en: "Integration name", de: "Name der Integration" },
  "integrations.consumerKey": { en: "Consumer key", de: "Consumer Key" },
  "integrations.consumerSecret": { en: "Consumer secret", de: "Consumer Secret" },
  "integrations.clientId": { en: "Client ID", de: "Client-ID" },
  "integrations.clientSecret": { en: "Client secret", de: "Client-Secret" },
  "integrations.accessToken": { en: "Admin API access token", de: "Admin-API-Zugriffstoken" },
  "integrations.comingSoon": { en: "Coming soon", de: "Demnächst" },
  "integrations.empty": { en: "No stores connected yet.", de: "Noch keine Shops verbunden." },
  "integrations.disconnectConfirm": { en: "Disconnect \"{name}\"? This permanently deletes its stored credentials and agent permissions for it.", de: "„{name}“ trennen? Dadurch werden gespeicherte Zugangsdaten und Agenten-Rechte dafür dauerhaft gelöscht." },
  // Agents
  "agents.title": { en: "Agents", de: "Agenten" },
  "agents.new": { en: "New agent", de: "Neuer Agent" },
  "agents.namePlaceholder": { en: "New agent name", de: "Name des neuen Agenten" },
  "agents.policyMatrix": { en: "Policy Matrix: Orders", de: "Rechte-Matrix: Bestellungen" },
  "agents.highRisk": { en: "High-risk tool — defaults to Require approval for every new agent.", de: "Risikoreiches Werkzeug — standardmäßig freigabepflichtig für jeden neuen Agenten." },
  "agents.selectPrompt": { en: "Select an agent to configure its permissions.", de: "Wählen Sie einen Agenten, um dessen Rechte zu konfigurieren." },
  "agents.nameRequired": { en: "Enter a name for the agent first.", de: "Bitte zuerst einen Namen für den Agenten eingeben." },
  // Approvals
  "approvals.title": { en: "Approvals Inbox", de: "Freigaben" },
  "approvals.subtitle": { en: "Review and authorize high-stakes agent actions before they execute.", de: "Prüfen und autorisieren Sie kritische Agenten-Aktionen vor der Ausführung." },
  "approvals.tab.pending": { en: "Pending", de: "Ausstehend" },
  "approvals.tab.history": { en: "Decided History", de: "Entscheidungsverlauf" },
  "approvals.approveRun": { en: "Approve — run it now", de: "Genehmigen — jetzt ausführen" },
  "approvals.showTech": { en: "Show technical details", de: "Technische Details anzeigen" },
  "approvals.reason": { en: "Provided reason", de: "Angegebener Grund" },
  "approvals.summary": { en: "Action summary", de: "Zusammenfassung" },
  "approvals.empty": { en: "Nothing pending.", de: "Nichts ausstehend." },
  // Audit
  "audit.title": { en: "Audit Logs", de: "Audit-Protokolle" },
  "audit.subtitle": { en: "Review and trace integration activity across all agents.", de: "Verfolgen Sie die Aktivität aller Agenten und Integrationen." },
  "audit.search": { en: "Search action or tool", de: "Aktion oder Tool suchen" },
  "audit.export": { en: "Export CSV", de: "CSV exportieren" },
  "audit.empty": { en: "No activity recorded yet.", de: "Noch keine Aktivität erfasst." },
  // API Keys
  "apiKeys.title": { en: "API Keys", de: "API-Schlüssel" },
  "apiKeys.subtitle": { en: "Manage access credentials for the Integration Hub.", de: "Verwalten Sie Zugangsdaten für den Integration Hub." },
  "apiKeys.create": { en: "Create API key", de: "API-Schlüssel erstellen" },
  "apiKeys.namePlaceholder": { en: "e.g. Production Hub Key", de: "z. B. Produktionsschlüssel" },
  "apiKeys.created": { en: "New API key created", de: "Neuer API-Schlüssel erstellt" },
  "apiKeys.saveNow": { en: "Save your key now", de: "Speichern Sie Ihren Schlüssel jetzt" },
  "apiKeys.saveWarning": { en: "For security reasons, this is the only time we will display this key. If you lose it, you will need to generate a new one.", de: "Aus Sicherheitsgründen wird dieser Schlüssel nur jetzt angezeigt. Bei Verlust muss ein neuer erstellt werden." },
  "apiKeys.quickStart": { en: "Quick Start", de: "Schnellstart" },
  "apiKeys.done": { en: "Done", de: "Fertig" },
  "apiKeys.copy": { en: "Copy", de: "Kopieren" },
  "apiKeys.empty": { en: "No API keys yet.", de: "Noch keine API-Schlüssel." },
  "apiKeys.nameRequired": { en: "Enter a name for the key first.", de: "Bitte zuerst einen Namen für den Schlüssel eingeben." },
  // Team
  "team.title": { en: "Team", de: "Team" },
  "team.subtitle": { en: "Manage who can access this project.", de: "Verwalten Sie den Zugriff auf dieses Projekt." },
  "team.emailPlaceholder": { en: "teammate@company.com", de: "kollege@firma.de" },
  "team.invite": { en: "Invite", de: "Einladen" },
  "team.role.member": { en: "Member", de: "Mitglied" },
  "team.role.owner": { en: "Owner", de: "Inhaber" },
  "team.col.email": { en: "Email", de: "E-Mail" },
  "team.col.role": { en: "Role", de: "Rolle" },
  "team.col.since": { en: "Member since", de: "Mitglied seit" },
  "team.empty": { en: "No teammates yet — invite one above.", de: "Noch keine Teammitglieder — oben einladen." },
  "team.invited": { en: "Invite created", de: "Einladung erstellt" },
  "team.inviteLinkHint": { en: "Invites aren't emailed automatically — copy this link and send it to your teammate yourself (Slack, email, however you like). It logs them straight in.", de: "Einladungen werden nicht automatisch per E-Mail versendet — kopieren Sie den Link und senden Sie ihn selbst (Slack, E-Mail, wie Sie möchten). Er meldet die Person direkt an." },
  "team.inviteLink": { en: "Invite link", de: "Einladungslink" },
  "team.emailRequired": { en: "Enter an email address first.", de: "Bitte zuerst eine E-Mail-Adresse eingeben." },
  // Account
  "account.title": { en: "My Account", de: "Mein Konto" },
  "account.subtitle": { en: "Manage your personal data.", de: "Verwalten Sie Ihre persönlichen Daten." },
  "account.export.title": { en: "Export your data", de: "Daten exportieren" },
  "account.export.body": { en: "Download everything this Hub holds about you — your profile, organization and project memberships, API key metadata, and approvals you requested or decided — as a JSON file.", de: "Laden Sie alles herunter, was dieser Hub über Sie speichert — Profil, Organisations- und Projektmitgliedschaften, API-Schlüssel-Metadaten sowie von Ihnen angeforderte oder entschiedene Freigaben — als JSON-Datei." },
  "account.export.button": { en: "Download my data", de: "Meine Daten herunterladen" },
  "account.delete.title": { en: "Delete account", de: "Konto löschen" },
  "account.delete.body": { en: "Permanently deletes your account and removes you from every organization and project. This cannot be undone. If you're the sole owner of a project, invite a co-owner or delete that project first.", de: "Löscht Ihr Konto dauerhaft und entfernt Sie aus allen Organisationen und Projekten. Dies kann nicht rückgängig gemacht werden. Sind Sie alleiniger Inhaber eines Projekts, laden Sie zuerst einen Mit-Inhaber ein oder löschen Sie das Projekt." },
  "account.delete.button": { en: "Delete my account", de: "Mein Konto löschen" },
  "account.delete.confirmButton": { en: "Yes, permanently delete", de: "Ja, endgültig löschen" },
  // Help
  "help.title": { en: "How can we help you?", de: "Wie können wir helfen?" },
  "help.subtitle": { en: "Search our knowledge base or browse by category.", de: "Durchsuchen Sie unsere Wissensdatenbank oder wählen Sie eine Kategorie." },
  "help.search": { en: "Search for 'WooCommerce', 'API Keys', 'Permissions'…", de: "Suche nach „WooCommerce“, „API-Schlüssel“, „Rechte“ …" },
  "help.stillStuck": { en: "Still stuck?", de: "Noch Fragen?" },
  "help.stillStuckBody": { en: "Our support team is ready to help with your integration.", de: "Unser Support-Team hilft Ihnen gerne bei Ihrer Integration." },
  // Landing
  "nav.features": { en: "Features", de: "Funktionen" },
  "nav.platforms": { en: "Platforms", de: "Plattformen" },
  "nav.docs": { en: "Docs", de: "Doku" },
  "landing.headline1": { en: "One canonical tool.", de: "Ein einheitliches Werkzeug." },
  "landing.headline2": { en: "Every commerce platform.", de: "Jede Commerce-Plattform." },
  "landing.subhead": { en: "Standardize your AI agent operations across disjointed e-commerce backends. Deploy policies, audit actions, and route intents through a single integration point.", de: "Vereinheitlichen Sie die Aktionen Ihrer KI-Agenten über verschiedene E-Commerce-Systeme hinweg. Richtlinien durchsetzen, Aktionen protokollieren, alles über einen Zugangspunkt." },
  "landing.getStarted": { en: "Get started", de: "Jetzt starten" },
  "landing.viewDocs": { en: "View documentation", de: "Dokumentation ansehen" },
  "landing.signIn": { en: "Sign in", de: "Anmelden" },
  "landing.supportedPlatforms": { en: "Supported Platforms", de: "Unterstützte Plattformen" },
  "landing.prop1.title": { en: "Connect once.", de: "Einmal verbinden." },
  "landing.prop1.body": { en: "Build your agent against a single, canonical schema. We handle the translation layer to every underlying commerce API automatically.", de: "Bauen Sie Ihren Agenten gegen ein einheitliches Schema. Wir übersetzen automatisch in jede zugrunde liegende Commerce-API." },
  "landing.prop2.title": { en: "Control access.", de: "Zugriff kontrollieren." },
  "landing.prop2.body": { en: "Define strict policies on what agents can do. Block destructive actions or require human-in-the-loop approval for high-value transactions.", de: "Legen Sie fest, was Agenten dürfen. Blockieren Sie kritische Aktionen oder verlangen Sie eine menschliche Freigabe bei hochwertigen Transaktionen." },
  "landing.prop3.title": { en: "Audit everything.", de: "Alles protokollieren." },
  "landing.prop3.body": { en: "Every API call, policy decision, and resulting payload is logged immutably. Trace any agent action back to its origin.", de: "Jeder API-Aufruf, jede Richtlinien-Entscheidung und jede Nutzlast wird unveränderlich protokolliert — jede Aktion bleibt nachvollziehbar." },
  "footer.rights": { en: "Technical AI Systems", de: "Technische KI-Systeme" },
  "footer.imprint": { en: "Imprint", de: "Impressum" },
  "footer.privacy": { en: "Privacy", de: "Datenschutz" },
  "footer.terms": { en: "Terms", de: "AGB" },
  "footer.help": { en: "Help", de: "Hilfe" },
};

export function t(key: string, lang: Lang): string {
  return STRINGS[key]?.[lang] ?? key;
}

interface I18nContextValue { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string }
const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("hub_lang") as Lang) || "en");
  const setLang = (l: Lang) => { localStorage.setItem("hub_lang", l); setLangState(l); };
  const value = useMemo<I18nContextValue>(() => ({ lang, setLang, t: (key: string) => t(key, lang) }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
