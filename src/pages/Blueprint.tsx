import { useI18n } from "../lib/i18n";
import { PublicShell } from "../components/PublicShell";
import { POLICY_STEPS, ROLES, WORKFLOWS } from "../lib/blueprintContent";
import { CATEGORY_LABEL, platformsByCategory } from "../lib/platformCatalog";

const SECTIONS = [
  { id: "architecture", labelKey: "blueprint.nav.architecture" },
  { id: "roles", labelKey: "blueprint.nav.roles" },
  { id: "workflows", labelKey: "blueprint.nav.workflows" },
  { id: "platforms", labelKey: "blueprint.nav.platforms" },
] as const;

function SectionNav() {
  const { t } = useI18n();
  return (
    <nav className="hidden lg:flex flex-col gap-1 w-52 shrink-0 sticky top-24 self-start">
      <span className="font-label-caps text-label-caps text-on-surface-variant mb-2 tracking-wide">{t("helpArticle.onThisPage")}</span>
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`} className="font-body-md text-body-md text-on-surface-variant hover:text-primary no-underline py-1.5 border-l-2 border-transparent hover:border-primary pl-3 -ml-px transition-colors">
          {t(s.labelKey)}
        </a>
      ))}
    </nav>
  );
}

export default function Blueprint() {
  const { lang, t } = useI18n();

  return (
    <PublicShell>
      <div className="max-w-7xl mx-auto px-margin-page py-margin-page">
        <div className="max-w-3xl mb-16 md:mb-24">
          <span className="inline-flex items-center gap-2 w-fit font-label-caps text-label-caps text-on-primary-container bg-primary-container px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-mint" />
            {t("blueprint.eyebrow")}
          </span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-4">{t("blueprint.title")}</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">{t("blueprint.subtitle")}</p>
        </div>

        <div className="flex flex-row gap-gutter">
          <SectionNav />

          <div className="flex flex-col w-full min-w-0 gap-24 md:gap-32">
            {/* ── Architecture ─────────────────────────────────────────── */}
            <section id="architecture" className="scroll-mt-24">
              <span className="font-label-caps text-label-caps text-primary">{t("blueprint.architecture.eyebrow")}</span>
              <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight mt-2 mb-6 max-w-2xl">{t("blueprint.architecture.title")}</h2>
              <div className="flex flex-col gap-4 max-w-3xl mb-12">
                <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">{t("blueprint.architecture.p1")}</p>
                <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">{t("blueprint.architecture.p2")}</p>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 md:p-8 mb-8">
                <span className="font-label-caps text-label-caps text-on-surface-variant block mb-6">{t("blueprint.architecture.diagramTitle")}</span>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                  {[
                    { label: t("blueprint.architecture.node.org"), icon: "corporate_fare", accent: true },
                    { label: t("blueprint.architecture.node.project"), icon: "folder_open", accent: true },
                    { label: t("blueprint.architecture.node.resources"), icon: "hub", accent: false },
                    { label: t("blueprint.architecture.node.outcome"), icon: "fact_check", accent: false },
                  ].map((node, i, arr) => (
                    <div key={node.label} className="flex items-center gap-3 flex-1">
                      <div className={"flex-1 flex items-center gap-3 rounded-lg border px-4 py-4 " + (node.accent ? "border-primary/40 bg-primary/5" : "border-outline-variant bg-surface")}>
                        <span className={"material-symbols-outlined text-[20px] shrink-0 " + (node.accent ? "text-primary" : "text-on-surface-variant")}>{node.icon}</span>
                        <span className="font-body-md text-body-md text-on-surface font-medium">{node.label}</span>
                      </div>
                      {i < arr.length - 1 && (
                        <span className="material-symbols-outlined text-on-surface-variant/50 rotate-90 md:rotate-0 shrink-0">arrow_forward</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <span className="md:col-span-2 font-label-caps text-label-caps text-on-surface-variant">{t("blueprint.architecture.policyTitle")}</span>
                {POLICY_STEPS.map((step, i) => (
                  <div key={i} className="flex items-start gap-4 p-5 bg-surface-container-lowest border border-outline-variant rounded-lg">
                    <span className="w-7 h-7 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-headline-sm text-[13px] shrink-0">{i + 1}</span>
                    <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{step[lang]}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Roles ─────────────────────────────────────────────────── */}
            <section id="roles" className="scroll-mt-24">
              <span className="font-label-caps text-label-caps text-primary">{t("blueprint.roles.eyebrow")}</span>
              <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight mt-2 mb-3 max-w-2xl">{t("blueprint.roles.title")}</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mb-10">{t("blueprint.roles.subtitle")}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {ROLES.map((role) => (
                  <div key={role.name.en} className="flex flex-col p-6 bg-surface-container-lowest border border-outline-variant rounded-lg">
                    <h3 className="font-headline-sm text-headline-sm text-on-surface mb-1">{role.name[lang]}</h3>
                    <span className="font-mono-data text-mono-data text-on-surface-variant mb-4">{role.scope[lang]}</span>
                    <ul className="flex flex-col gap-3">
                      {role.points.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="material-symbols-outlined text-[16px] text-primary mt-0.5 shrink-0">check</span>
                          <span className="font-body-md text-body-md text-on-surface-variant leading-snug">{pt[lang]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Workflows ─────────────────────────────────────────────── */}
            <section id="workflows" className="scroll-mt-24">
              <span className="font-label-caps text-label-caps text-primary">{t("blueprint.workflows.eyebrow")}</span>
              <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight mt-2 mb-10 max-w-2xl">{t("blueprint.workflows.title")}</h2>

              <div className="flex flex-col">
                {WORKFLOWS.map((wf, i) => (
                  <div key={wf.title.en} className={"grid grid-cols-[auto_1fr] gap-6 py-7 " + (i > 0 ? "border-t border-outline-variant" : "")}>
                    <span className="font-headline-md text-headline-md text-on-surface-variant/40 tabular-nums w-10">{String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <h3 className="font-headline-sm text-headline-sm text-on-surface">{wf.title[lang]}</h3>
                        <span className="font-label-caps text-label-caps text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-full">{wf.tag[lang]}</span>
                      </div>
                      <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed max-w-2xl">{wf.body[lang]}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Platforms ─────────────────────────────────────────────── */}
            <section id="platforms" className="scroll-mt-24">
              <span className="font-label-caps text-label-caps text-primary">{t("blueprint.platforms.eyebrow")}</span>
              <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight mt-2 mb-3 max-w-2xl">{t("blueprint.platforms.title")}</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mb-10">{t("blueprint.platforms.subtitle")}</p>

              <div className="flex flex-col gap-8">
                {platformsByCategory().map((group) => (
                  <div key={group.category}>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-3 tracking-wide">{CATEGORY_LABEL[group.category][lang]}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {group.platforms.map((p) => (
                        <div key={p.id} className="flex items-start gap-4 p-6 bg-surface-container-lowest border border-outline-variant rounded-lg hover:border-primary/40 hover:shadow-card transition-all">
                          <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${p.color}1a`, color: p.color }}>
                            <span className="material-symbols-outlined text-[22px]">{p.icon}</span>
                          </div>
                          <div>
                            <h4 className="font-headline-sm text-headline-sm text-on-surface mb-1">{p.name}</h4>
                            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{p.description[lang]}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
