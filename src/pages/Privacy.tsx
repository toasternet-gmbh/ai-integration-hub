import { useI18n } from "../lib/i18n";
import { PublicShell } from "../components/PublicShell";

const TOC = {
  en: ["Data Controller", "Data Collection", "Purpose of Processing", "Third-Party Sharing", "Your GDPR Rights", "Contact Information"],
  de: ["Verantwortlicher", "Datenerhebung", "Zweck der Verarbeitung", "Weitergabe an Dritte", "Ihre Rechte nach der DSGVO", "Kontakt"],
};

export default function Privacy() {
  const { lang } = useI18n();
  const toc = TOC[lang];
  const en = lang === "en";

  return (
    <PublicShell>
      <div className="flex flex-col w-full relative pb-margin-page bg-surface text-on-surface">
        <div className="px-margin-page py-gutter bg-surface-container-low border-b border-outline-variant">
          <div className="max-w-6xl mx-auto flex flex-col gap-unit">
            <h1 className="font-headline-lg text-primary tracking-tight">{en ? "Privacy Policy" : "Datenschutzerklärung"}</h1>
            <p className="font-body-lg text-on-surface-variant max-w-2xl">
              {en ? "Effective date" : "Gültig ab"}: <span className="font-mono-data text-on-surface">2026-08-23</span>
            </p>
          </div>
        </div>

        <div className="w-full flex-grow flex justify-center px-margin-page py-margin-page">
          <div className="max-w-6xl w-full flex flex-col lg:flex-row gap-margin-page relative">
            <aside className="w-full lg:w-64 shrink-0 hidden lg:block">
              <nav className="sticky top-[100px] flex flex-col gap-unit border-l border-outline-variant pl-gutter py-2">
                <p className="font-label-caps text-on-surface-variant uppercase mb-2">{en ? "Contents" : "Inhalt"}</p>
                {toc.map((item, i) => (
                  <a key={item} href={`#s${i + 1}`} className="font-body-md text-on-surface hover:text-primary transition-colors py-1 no-underline">{i + 1}. {item}</a>
                ))}
              </nav>
            </aside>

            <div className="flex-grow max-w-3xl flex flex-col gap-margin-page">
              <section id="s1" className="flex flex-col gap-component-gap">
                <SectionHeader n="01" title={toc[0]} />
                <p className="font-body-lg text-on-surface-variant leading-relaxed">
                  {en ? "The entity responsible for data processing on this platform is:" : "Verantwortlich für die Datenverarbeitung auf dieser Plattform ist:"}
                </p>
                <div className="p-gutter bg-surface-container border border-outline-variant rounded-sm flex flex-col gap-2 font-mono-data text-on-surface text-sm">
                  <span>Innov-AI-tive GmbH</span>
                  <span>Bahnhofplatz 1</span>
                  <span>91054 Erlangen, {en ? "Germany" : "Deutschland"}</span>
                  <span>{en ? "Commercial Register" : "Handelsregister"}: HRB 13346 ({en ? "Amtsgericht Fürth" : "Amtsgericht Fürth"})</span>
                  <span>{en ? "Managing Director" : "Geschäftsführer"}: Tobias Hartmann</span>
                </div>
              </section>

              <Divider />

              <section id="s2" className="flex flex-col gap-component-gap">
                <SectionHeader n="02" title={toc[1]} />
                <p className="font-body-lg text-on-surface-variant leading-relaxed">
                  {en ? "To provide our orchestration services, we collect and process the following categories of data:" : "Zur Bereitstellung unserer Orchestrierungsdienste erheben und verarbeiten wir folgende Datenkategorien:"}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter mt-4">
                  <DataCard icon="badge" color="primary" title={en ? "Account Data" : "Kontodaten"} items={en ? ["Email address", "Organization membership", "User roles and permissions"] : ["E-Mail-Adresse", "Organisationszugehörigkeit", "Benutzerrollen und Berechtigungen"]} />
                  <DataCard icon="key" color="secondary" title={en ? "Technical Data" : "Technische Daten"} items={en ? ["Encrypted API credentials", "Integration endpoint configurations"] : ["Verschlüsselte API-Zugangsdaten", "Konfigurationen der Integrations-Endpunkte"]} />
                  <DataCard icon="history" color="tertiary" title={en ? "System Logs" : "Systemprotokolle"} items={en ? ["System access audit logs", "API request metadata", "IP addresses (anonymized after 7 days)"] : ["Zugriffsprotokolle", "Metadaten von API-Anfragen", "IP-Adressen (nach 7 Tagen anonymisiert)"]} />
                </div>
              </section>

              <Divider />

              <section id="s3" className="flex flex-col gap-component-gap">
                <SectionHeader n="03" title={toc[2]} />
                <p className="font-body-lg text-on-surface-variant leading-relaxed mb-2">
                  {en ? "The collected data is strictly used for the following operational purposes:" : "Die erhobenen Daten werden ausschließlich für folgende Zwecke verwendet:"}
                </p>
                <div className="overflow-x-auto w-full border border-outline-variant rounded-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container font-label-caps text-on-surface-variant uppercase border-b border-outline-variant">
                        <th className="p-component-gap font-medium">{en ? "Data Category" : "Datenkategorie"}</th>
                        <th className="p-component-gap font-medium">{en ? "Legal Basis (GDPR)" : "Rechtsgrundlage (DSGVO)"}</th>
                        <th className="p-component-gap font-medium">{en ? "Primary Purpose" : "Hauptzweck"}</th>
                      </tr>
                    </thead>
                    <tbody className="font-body-md text-on-surface">
                      <tr className="border-b border-outline-variant">
                        <td className="p-component-gap font-mono-data">{en ? "Account Data" : "Kontodaten"}</td>
                        <td className="p-component-gap">Art. 6(1)(b) {en ? "Contract" : "Vertrag"}</td>
                        <td className="p-component-gap">{en ? "Authentication and authorization" : "Authentifizierung und Autorisierung"}</td>
                      </tr>
                      <tr className="border-b border-outline-variant">
                        <td className="p-component-gap font-mono-data">{en ? "Technical Data" : "Technische Daten"}</td>
                        <td className="p-component-gap">Art. 6(1)(b) {en ? "Contract" : "Vertrag"}</td>
                        <td className="p-component-gap">{en ? "Execution of automated AI workflows" : "Ausführung automatisierter KI-Workflows"}</td>
                      </tr>
                      <tr>
                        <td className="p-component-gap font-mono-data">{en ? "System Logs" : "Systemprotokolle"}</td>
                        <td className="p-component-gap">Art. 6(1)(f) {en ? "Legitimate Interest" : "Berechtigtes Interesse"}</td>
                        <td className="p-component-gap">{en ? "Security monitoring and debugging" : "Sicherheitsüberwachung und Fehlerbehebung"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <Divider />

              <section id="s4" className="flex flex-col gap-component-gap">
                <SectionHeader n="04" title={toc[3]} />
                <p className="font-body-lg text-on-surface-variant leading-relaxed">
                  {en
                    ? "We operate as a central hub connecting various services. By configuring integrations, you authorize the transmission of specific payloads to these third parties."
                    : "Wir betreiben eine zentrale Plattform, die verschiedene Dienste verbindet. Durch das Einrichten von Integrationen autorisieren Sie die Übermittlung bestimmter Daten an diese Drittanbieter."}
                </p>
                <div className="bg-surface-variant p-gutter rounded-sm border border-outline-variant flex flex-col gap-3 mt-2">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-on-surface-variant mt-1">storefront</span>
                    <div className="flex flex-col">
                      <h4 className="font-headline-sm text-on-surface">{en ? "Commerce Platforms" : "Commerce-Plattformen"}</h4>
                      <p className="font-body-md text-on-surface-variant mt-1">
                        {en
                          ? "When connecting e-commerce platforms (e.g., WooCommerce, Shopware), product metadata and relevant order contexts are transmitted to execute AI-driven actions. We do not transmit customer personally identifiable information (PII) to AI models unless explicitly configured by your organization's administrators."
                          : "Beim Verbinden von E-Commerce-Plattformen (z. B. WooCommerce, Shopware) werden Produktmetadaten und relevante Bestellkontexte übermittelt, um KI-gesteuerte Aktionen auszuführen. Wir übermitteln keine personenbezogenen Kundendaten an KI-Modelle, sofern dies nicht ausdrücklich von den Administratoren Ihrer Organisation konfiguriert wurde."}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <Divider />

              <section id="s5" className="flex flex-col gap-component-gap">
                <SectionHeader n="05" title={toc[4]} />
                <p className="font-body-lg text-on-surface-variant leading-relaxed">
                  {en ? "Under the General Data Protection Regulation (GDPR), you have the following rights regarding your personal data:" : "Nach der Datenschutz-Grundverordnung (DSGVO) haben Sie folgende Rechte bezüglich Ihrer personenbezogenen Daten:"}
                </p>
                <div className="flex flex-col gap-4 mt-2">
                  <Right icon="visibility" title={en ? "Right to Access" : "Recht auf Auskunft"} body={en ? "Request a copy of the personal data we hold about you." : "Fordern Sie eine Kopie der über Sie gespeicherten personenbezogenen Daten an."} />
                  <Right icon="edit" title={en ? "Right to Rectification" : "Recht auf Berichtigung"} body={en ? "Request correction of inaccurate or incomplete data." : "Fordern Sie die Korrektur unrichtiger oder unvollständiger Daten an."} />
                  <Right icon="delete" title={en ? "Right to Erasure" : "Recht auf Löschung"} body={en ? "Request deletion of your data under specific circumstances (\"right to be forgotten\")." : "Fordern Sie unter bestimmten Umständen die Löschung Ihrer Daten an („Recht auf Vergessenwerden“)."} />
                  <Right icon="download" title={en ? "Right to Data Portability" : "Recht auf Datenübertragbarkeit"} body={en ? "Request your data in a structured, commonly used, machine-readable format." : "Fordern Sie Ihre Daten in einem strukturierten, gängigen, maschinenlesbaren Format an."} />
                </div>
              </section>

              <Divider />

              <section id="s6" className="flex flex-col gap-component-gap pb-12">
                <SectionHeader n="06" title={toc[5]} />
                <p className="font-body-lg text-on-surface-variant leading-relaxed">
                  {en ? "To exercise your rights or if you have questions about our data practices, contact us:" : "Um Ihre Rechte auszuüben oder bei Fragen zu unseren Datenschutzpraktiken, kontaktieren Sie uns:"}
                </p>
                <div className="inline-flex flex-col gap-2 p-gutter bg-surface-container border border-outline-variant mt-2 w-max rounded-sm">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-on-surface-variant">mail</span>
                    <span className="font-mono-data text-on-surface">info@innov-ai-tive.de</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

function SectionHeader({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-mono-data">{n}</div>
      <h2 className="font-headline-md text-on-surface">{title}</h2>
    </div>
  );
}

function Divider() {
  return <div className="w-full h-px bg-outline-variant" />;
}

function DataCard({ icon, color, title, items }: { icon: string; color: string; title: string; items: string[] }) {
  const border = { primary: "border-primary", secondary: "border-secondary", tertiary: "border-tertiary" }[color];
  const text = { primary: "text-primary", secondary: "text-secondary", tertiary: "text-tertiary" }[color];
  return (
    <div className={`flex flex-col gap-2 p-component-gap bg-surface-container-low border-l-2 ${border}`}>
      <div className={`flex items-center gap-2 ${text}`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
        <h3 className="font-headline-sm">{title}</h3>
      </div>
      <ul className="font-body-md text-on-surface-variant list-disc pl-5 space-y-1">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </div>
  );
}

function Right({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-6 h-6 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center mt-0.5 shrink-0">
        <span className="material-symbols-outlined text-primary text-[14px]">{icon}</span>
      </div>
      <div>
        <h4 className="font-headline-sm text-on-surface">{title}</h4>
        <p className="font-body-md text-on-surface-variant">{body}</p>
      </div>
    </div>
  );
}
