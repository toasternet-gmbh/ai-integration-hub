import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { PublicShell } from "../components/PublicShell";
import { CATEGORY_LABEL, CATEGORY_ORDER, HELP_ARTICLES, type HelpCategory } from "../lib/helpArticles";
import { DocsSidebar } from "../components/DocsSidebar";

const CATEGORY_META: Record<HelpCategory, { icon: string; tone: string; title: { en: string; de: string }; body: { en: string; de: string } }> = {
  operations: {
    icon: "fact_check", tone: "secondary",
    title: { en: "I approve or deny requests", de: "Ich genehmige oder lehne Anfragen ab" },
    body: { en: "Guides for Operations and Management overseeing agent actions.", de: "Anleitungen für Betrieb und Management zur Überwachung von Agenten-Aktionen." },
  },
  admin: {
    icon: "hub", tone: "primary",
    title: { en: "I manage stores & agents", de: "Ich verwalte Shops & Agenten" },
    body: { en: "Documentation for Administrators configuring the Hub.", de: "Dokumentation für Administratoren, die den Hub konfigurieren." },
  },
  developer: {
    icon: "terminal", tone: "tertiary",
    title: { en: "I'm integrating via API", de: "Ich integriere über die API" },
    body: { en: "Technical references for Developers and System Architects.", de: "Technische Referenzen für Entwickler und Systemarchitekten." },
  },
};

const TONE_BG: Record<string, string> = { secondary: "bg-secondary-container text-on-secondary-container", primary: "bg-primary-container text-on-primary-container", tertiary: "bg-tertiary-container text-on-tertiary-container" };

const FEATURED_SLUG = "getting-started-with-ai-integration-hub";
const POPULAR_SLUGS = ["how-to-rotate-api-keys", "troubleshooting-a-failed-connection", "policy-engine-basics", "handling-require-approval"];

export default function Help() {
  const { lang, t, path } = useI18n();
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filtered = query
    ? HELP_ARTICLES.filter((a) =>
        a.title[lang].toLowerCase().includes(query) ||
        a.summary[lang].toLowerCase().includes(query) ||
        a.body[lang].some((p) => p.toLowerCase().includes(query)))
    : null;

  const featured = HELP_ARTICLES.find((a) => a.slug === FEATURED_SLUG)!;
  const popular = POPULAR_SLUGS.map((slug) => HELP_ARTICLES.find((a) => a.slug === slug)!).filter(Boolean);

  return (
    <PublicShell>
      <div className="flex flex-row w-full px-gutter md:px-margin-page pb-24 max-w-7xl mx-auto gap-gutter">
        <DocsSidebar />
        <div className="flex flex-col w-full min-w-0">
        <div className="w-full text-center py-16 md:py-24 relative">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-unit">{t("help.title")}</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-component-gap">{t("help.subtitle")}</p>
          <div className="max-w-2xl mx-auto relative mt-8 shadow-xl shadow-surface-container-highest/50 rounded-full">
            <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline text-[24px]">search</span>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-16 pr-6 py-6 bg-surface-container-lowest text-on-surface font-body-lg text-body-lg rounded-full focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-outline-variant"
              placeholder={t("help.search")}
              type="text"
            />
          </div>
        </div>

        {filtered ? (
          <div className="w-full bg-surface-container-lowest rounded-xl shadow-sm p-2 md:p-6">
            {filtered.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant p-4">{t("help.noResults")}</p>}
            <ul className="flex flex-col space-y-2">
              {filtered.map((a) => (
                <li key={a.slug}>
                  <Link to={path(`/help/${a.slug}`)} className="flex items-center justify-between p-4 hover:bg-surface-container rounded-lg transition-colors no-underline">
                    <div className="flex items-center gap-4">
                      <span className="material-symbols-outlined text-on-surface-variant">article</span>
                      <div>
                        <h4 className="font-body-lg text-body-lg text-on-surface font-medium">{a.title[lang]}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono-data text-mono-data text-on-surface-variant">{CATEGORY_LABEL[a.category][lang]}</span>
                          <span className="w-1 h-1 rounded-full bg-outline-variant" />
                          <span className="font-mono-data text-mono-data text-on-surface-variant">{a.readMins} {t("help.minRead")}</span>
                        </div>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-gutter mt-8">
              {CATEGORY_ORDER.map((cat) => {
                const meta = CATEGORY_META[cat];
                const articles = HELP_ARTICLES.filter((a) => a.category === cat).slice(0, 3);
                return (
                  <div key={cat} className="bg-surface-container-lowest rounded-xl p-gutter shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-6 shadow-sm ${TONE_BG[meta.tone]}`}>
                      <span className="material-symbols-outlined">{meta.icon}</span>
                    </div>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface mb-2">{meta.title[lang]}</h2>
                    <p className="font-body-md text-body-md text-on-surface-variant mb-6">{meta.body[lang]}</p>
                    <div className="space-y-4">
                      {articles.map((a) => (
                        <Link key={a.slug} to={path(`/help/${a.slug}`)} className="flex items-start gap-3 no-underline">
                          <span className="material-symbols-outlined text-[18px] text-primary mt-0.5">arrow_forward</span>
                          <span className="font-body-md text-body-md text-primary font-medium">{a.title[lang]}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="w-full mt-16 md:mt-24 grid grid-cols-1 md:grid-cols-12 gap-gutter">
              <div className="md:col-span-4">
                <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{t("help.popularArticles")}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                  {t("help.popularSubtitle")}
                </p>
                <Link to={path(`/help/${featured.slug}`)} className="block w-full rounded-xl overflow-hidden shadow-sm relative group bg-primary p-6 min-h-[220px] flex flex-col justify-end no-underline">
                  <span className="font-label-caps text-label-caps text-on-primary/80 mb-2">{t("help.featuredGuide")}</span>
                  <h4 className="font-headline-sm text-headline-sm text-on-primary">{featured.title[lang]}</h4>
                </Link>
              </div>
              <div className="md:col-span-8 bg-surface-container-lowest rounded-xl shadow-sm p-2 md:p-6">
                <ul className="flex flex-col space-y-2">
                  {popular.map((a, i) => (
                    <li key={a.slug} className="group">
                      <Link to={path(`/help/${a.slug}`)} className="flex items-center justify-between p-4 hover:bg-surface-container rounded-lg transition-colors no-underline">
                        <div className="flex items-center gap-4">
                          <span className="material-symbols-outlined text-on-surface-variant">article</span>
                          <div>
                            <h4 className="font-body-lg text-body-lg text-on-surface font-medium group-hover:text-primary transition-colors">{a.title[lang]}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-mono-data text-mono-data text-on-surface-variant">{CATEGORY_LABEL[a.category][lang]}</span>
                              <span className="w-1 h-1 rounded-full bg-outline-variant" />
                              <span className="font-mono-data text-mono-data text-on-surface-variant">{a.readMins} {t("help.minRead")}</span>
                            </div>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-outline-variant group-hover:text-primary group-hover:translate-x-1 transition-all">chevron_right</span>
                      </Link>
                      {i < popular.length - 1 && <div className="w-full h-px bg-surface-container-highest my-2" />}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}

        <div className="w-full mt-16 md:mt-24 flex justify-center md:justify-end">
          <div className="bg-surface-container-lowest shadow-xl rounded-2xl p-6 flex items-start gap-4 border-l-4 border-primary max-w-sm">
            <div className="w-10 h-10 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">support_agent</span>
            </div>
            <div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface mb-1">{t("help.stillStuck")}</h4>
              <p className="font-body-md text-body-md text-on-surface-variant mb-3">{t("help.stillStuckBody")}</p>
              <a href="mailto:info@innov-ai-tive.de" className="font-mono-data text-mono-data text-primary flex items-center gap-2 no-underline">
                <span className="material-symbols-outlined text-[16px]">mail</span> info@innov-ai-tive.de
              </a>
            </div>
          </div>
        </div>
        </div>
      </div>
    </PublicShell>
  );
}
