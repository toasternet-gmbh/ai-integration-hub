import { useI18n } from "../lib/i18n";
import { PublicShell } from "../components/PublicShell";

const TOC = {
  en: ["Acceptance of Terms", "The Service", "Accounts & Responsibilities", "Acceptable Use", "Service Availability", "Termination", "Liability", "Governing Law", "Contact"],
  de: ["Annahme der Bedingungen", "Der Dienst", "Konten & Verantwortlichkeiten", "Zulässige Nutzung", "Verfügbarkeit des Dienstes", "Kündigung", "Haftung", "Anwendbares Recht", "Kontakt"],
};

export default function Terms() {
  const { lang } = useI18n();
  const toc = TOC[lang];
  const en = lang === "en";

  return (
    <PublicShell>
      <div className="flex flex-col w-full relative pb-margin-page bg-surface text-on-surface">
        <div className="px-margin-page py-gutter bg-surface-container-low border-b border-outline-variant">
          <div className="max-w-6xl mx-auto flex flex-col gap-unit">
            <h1 className="font-headline-lg text-primary tracking-tight">{en ? "Terms of Service" : "Nutzungsbedingungen"}</h1>
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
                  {en
                    ? "These Terms of Service (\"Terms\") govern access to and use of AI Integration Hub (\"the Service\"), operated by Innov-AI-tive GmbH, Bahnhofplatz 1, 91054 Erlangen, Germany (\"we\", \"us\"). By creating an account or otherwise using the Service, you agree to these Terms. If you are using the Service on behalf of an organization, you confirm you have authority to bind that organization, and \"you\" refers to that organization."
                    : "Diese Nutzungsbedingungen (\"Bedingungen\") regeln den Zugriff auf und die Nutzung von AI Integration Hub (\"der Dienst\"), betrieben von der Innov-AI-tive GmbH, Bahnhofplatz 1, 91054 Erlangen (\"wir\", \"uns\"). Durch die Erstellung eines Kontos oder die anderweitige Nutzung des Dienstes stimmen Sie diesen Bedingungen zu. Nutzen Sie den Dienst im Namen einer Organisation, bestätigen Sie, zu deren Vertretung berechtigt zu sein; \"Sie\" bezieht sich dann auf diese Organisation."}
                </p>
              </section>

              <Divider />

              <section id="s2" className="flex flex-col gap-component-gap">
                <SectionHeader n="02" title={toc[1]} />
                <p className="font-body-lg text-on-surface-variant leading-relaxed">
                  {en
                    ? "The Service lets you connect AI agents to external commerce platforms (currently WooCommerce, Shopware, Shopify, and Magento) through a canonical set of tools, gated by a policy engine you configure. Depending on the policy, an action either executes automatically, is denied, or is parked for a human to approve before it runs. We may add, change, or remove platform connectors and tools over time."
                    : "Der Dienst ermöglicht die Anbindung von KI-Agenten an externe Commerce-Plattformen (derzeit WooCommerce, Shopware, Shopify und Magento) über einen einheitlichen Satz von Werkzeugen, gesteuert durch eine von Ihnen konfigurierte Policy Engine. Je nach Richtlinie wird eine Aktion automatisch ausgeführt, abgelehnt oder zur menschlichen Freigabe vorgemerkt. Wir können Plattform-Connector und Werkzeuge im Zeitverlauf hinzufügen, ändern oder entfernen."}
                </p>
              </section>

              <Divider />

              <section id="s3" className="flex flex-col gap-component-gap">
                <SectionHeader n="03" title={toc[2]} />
                <ul className="font-body-lg text-on-surface-variant leading-relaxed list-disc pl-5 space-y-2">
                  <li>{en ? "You are responsible for the accuracy of information you provide and for keeping your credentials (password, API keys, connected-platform credentials) confidential." : "Sie sind verantwortlich für die Richtigkeit der von Ihnen bereitgestellten Informationen und für die Vertraulichkeit Ihrer Zugangsdaten (Passwort, API-Schlüssel, Zugangsdaten verbundener Plattformen)."}</li>
                  <li>{en ? "You are responsible for actions taken by API keys and agents you create, including actions an AI agent takes within the permissions you grant it." : "Sie sind verantwortlich für Aktionen, die von Ihnen erstellte API-Schlüssel und Agenten ausführen, einschließlich Aktionen eines KI-Agenten innerhalb der von Ihnen erteilten Berechtigungen."}</li>
                  <li>{en ? "You must have the right to connect any external platform (e.g. a WooCommerce store) you configure through the Service." : "Sie müssen berechtigt sein, jede über den Dienst konfigurierte externe Plattform (z. B. einen WooCommerce-Shop) zu verbinden."}</li>
                  <li>{en ? "Project owners are responsible for managing who else has access to a project's integrations, agents, and approvals." : "Projektinhaber sind dafür verantwortlich, zu verwalten, wer sonst Zugriff auf Integrationen, Agenten und Freigaben eines Projekts hat."}</li>
                </ul>
              </section>

              <Divider />

              <section id="s4" className="flex flex-col gap-component-gap">
                <SectionHeader n="04" title={toc[3]} />
                <p className="font-body-lg text-on-surface-variant leading-relaxed mb-2">
                  {en ? "You agree not to use the Service to:" : "Sie verpflichten sich, den Dienst nicht zu nutzen, um:"}
                </p>
                <ul className="font-body-lg text-on-surface-variant leading-relaxed list-disc pl-5 space-y-2">
                  <li>{en ? "Access or attempt to access data, integrations, or accounts you are not authorized to access." : "Auf Daten, Integrationen oder Konten zuzugreifen oder dies zu versuchen, für die Sie nicht berechtigt sind."}</li>
                  <li>{en ? "Circumvent rate limits, the policy engine, or approval requirements." : "Ratenbegrenzungen, die Policy Engine oder Freigabepflichten zu umgehen."}</li>
                  <li>{en ? "Use the Service to violate any applicable law, or the terms of any third-party platform you connect (e.g. a commerce platform's own API terms)." : "Geltendes Recht oder die Bedingungen einer verbundenen Drittplattform (z. B. die API-Bedingungen einer Commerce-Plattform) zu verletzen."}</li>
                  <li>{en ? "Probe, scan, or test the vulnerability of the Service without our prior written consent." : "Die Sicherheit des Dienstes ohne unsere vorherige schriftliche Zustimmung zu testen oder zu untersuchen."}</li>
                </ul>
              </section>

              <Divider />

              <section id="s5" className="flex flex-col gap-component-gap">
                <SectionHeader n="05" title={toc[4]} />
                <p className="font-body-lg text-on-surface-variant leading-relaxed">
                  {en
                    ? "We aim to keep the Service available and reliable but do not guarantee uninterrupted access. We may perform maintenance, and features may change as the Service evolves. Connected third-party platforms (e.g. your commerce platform) are outside our control, and their availability or behavior is not our responsibility."
                    : "Wir bemühen uns um eine verfügbare und zuverlässige Bereitstellung des Dienstes, garantieren jedoch keinen unterbrechungsfreien Zugriff. Wartungsarbeiten können erforderlich sein, und Funktionen können sich im Zuge der Weiterentwicklung ändern. Verbundene Drittplattformen (z. B. Ihre Commerce-Plattform) liegen außerhalb unserer Kontrolle; deren Verfügbarkeit oder Verhalten liegt nicht in unserer Verantwortung."}
                </p>
              </section>

              <Divider />

              <section id="s6" className="flex flex-col gap-component-gap">
                <SectionHeader n="06" title={toc[5]} />
                <p className="font-body-lg text-on-surface-variant leading-relaxed">
                  {en
                    ? "You may stop using the Service and delete your account at any time from My Account. We may suspend or terminate access for a violation of these Terms, or where required by law. Deleting an account is permanent and, as described in our Privacy Policy, removes your membership from every organization and project — a sole project owner must transfer or share ownership before their account can be deleted."
                    : "Sie können die Nutzung des Dienstes jederzeit beenden und Ihr Konto über \"Mein Konto\" löschen. Wir können den Zugriff bei einem Verstoß gegen diese Bedingungen oder aus rechtlichen Gründen aussetzen oder beenden. Das Löschen eines Kontos ist endgültig und entfernt, wie in unserer Datenschutzerklärung beschrieben, Ihre Mitgliedschaft aus allen Organisationen und Projekten — ein alleiniger Projektinhaber muss die Inhaberschaft zuvor übertragen oder teilen."}
                </p>
              </section>

              <Divider />

              <section id="s7" className="flex flex-col gap-component-gap">
                <SectionHeader n="07" title={toc[6]} />
                <p className="font-body-lg text-on-surface-variant leading-relaxed">
                  {en
                    ? "The Service is provided \"as is\". To the extent permitted by law, we are not liable for indirect, incidental, or consequential damages, or for actions taken by an AI agent within permissions you configured for it (including actions your policy engine set to auto-allow). Nothing in these Terms limits liability that cannot be excluded under German law, including for intent or gross negligence."
                    : "Der Dienst wird \"wie besehen\" bereitgestellt. Soweit gesetzlich zulässig, haften wir nicht für indirekte, beiläufige oder Folgeschäden, oder für Aktionen eines KI-Agenten innerhalb der von Ihnen konfigurierten Berechtigungen (einschließlich Aktionen, die Ihre Policy Engine automatisch zugelassen hat). Nichts in diesen Bedingungen beschränkt eine Haftung, die nach deutschem Recht nicht ausgeschlossen werden kann, insbesondere bei Vorsatz oder grober Fahrlässigkeit."}
                </p>
              </section>

              <Divider />

              <section id="s8" className="flex flex-col gap-component-gap">
                <SectionHeader n="08" title={toc[7]} />
                <p className="font-body-lg text-on-surface-variant leading-relaxed">
                  {en
                    ? "These Terms are governed by the laws of Germany. The place of jurisdiction, to the extent legally permissible, is Erlangen, Germany."
                    : "Diese Bedingungen unterliegen dem Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit gesetzlich zulässig, Erlangen."}
                </p>
              </section>

              <Divider />

              <section id="s9" className="flex flex-col gap-component-gap pb-12">
                <SectionHeader n="09" title={toc[8]} />
                <p className="font-body-lg text-on-surface-variant leading-relaxed">
                  {en ? "Questions about these Terms? Contact us:" : "Fragen zu diesen Bedingungen? Kontaktieren Sie uns:"}
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
