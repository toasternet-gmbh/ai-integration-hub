import { useI18n } from "../lib/i18n";
import { PublicShell } from "../components/PublicShell";

const COPY = {
  en: {
    title: "Impressum", subtitle: "Legal Disclosure",
    s1: "Information according to § 5 TMG", s1body: "Innov-AI-tive GmbH\nBahnhofplatz 1\n91054 Erlangen\nGermany",
    s2: "Represented by", s2body: "Managing Director: Tobias Hartmann",
    s3: "Register Entry", s3body: "Entry in the Handelsregister.\nRegistering court: Amtsgericht Fürth\nRegistration number: HRB 13346",
    s4: "Contact", s4body: "Email: info@innov-ai-tive.de",
    s5: "Responsible for Content", s5body: "Tobias Hartmann\n(Address as above)",
    s6: "EU Dispute Resolution",
    s6body: "The European Commission provides a platform for online dispute resolution (OS): https://ec.europa.eu/consumers/odr/.\nOur email address can be found above in the site notice.\n\nWe are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.",
  },
  de: {
    title: "Impressum", subtitle: "Angaben gemäß § 5 TMG",
    s1: "Angaben gemäß § 5 TMG", s1body: "Innov-AI-tive GmbH\nBahnhofplatz 1\n91054 Erlangen\nDeutschland",
    s2: "Vertreten durch", s2body: "Geschäftsführer: Tobias Hartmann",
    s3: "Registereintrag", s3body: "Eintragung im Handelsregister.\nRegistergericht: Amtsgericht Fürth\nRegisternummer: HRB 13346",
    s4: "Kontakt", s4body: "E-Mail: info@innov-ai-tive.de",
    s5: "Verantwortlich für den Inhalt", s5body: "Tobias Hartmann\n(Anschrift wie oben)",
    s6: "EU-Streitschlichtung",
    s6body: "Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr/.\nUnsere E-Mail-Adresse finden Sie oben im Impressum.\n\nWir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
  },
};

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h2 className="font-headline-sm text-headline-sm text-on-surface mb-component-gap">{title}</h2>
      <p className="font-body-lg text-body-lg text-on-surface leading-relaxed whitespace-pre-line">{body}</p>
    </section>
  );
}

export default function Imprint() {
  const { lang } = useI18n();
  const c = COPY[lang];
  return (
    <PublicShell>
      <div className="flex flex-col w-full max-w-3xl mx-auto px-margin-page py-margin-page">
        <div className="mb-gutter">
          <h1 className="font-headline-lg text-headline-lg text-primary mb-unit">{c.title}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{c.subtitle}</p>
        </div>
        <div className="h-[1px] w-full bg-outline-variant mb-margin-page opacity-50" />
        <div className="flex flex-col gap-margin-page">
          <Section title={c.s1} body={c.s1body} />
          <Section title={c.s2} body={c.s2body} />
          <Section title={c.s3} body={c.s3body} />
          <Section title={c.s4} body={c.s4body} />
          <Section title={c.s5} body={c.s5body} />
          <div className="h-[1px] w-full bg-outline-variant opacity-50" />
          <section>
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-component-gap">{c.s6}</h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed whitespace-pre-line">
              {c.s6body}
            </p>
          </section>
        </div>
      </div>
    </PublicShell>
  );
}
