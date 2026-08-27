import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useSession } from "../lib/useSession";
import { PublicShell } from "../components/PublicShell";
import { ProductPreview } from "../components/ProductPreview";
import { CATEGORY_LABEL, platformsByCategory } from "../lib/platformCatalog";

export default function Landing() {
  const { t, path, lang } = useI18n();
  const signedIn = useSession();
  return (
    <PublicShell>
      <div className="relative min-h-screen overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(20,24,31,0.03) 1px, transparent 0)", backgroundSize: "24px 24px" }}
        />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-brand-radial-glow pointer-events-none z-0" />
        <div className="max-w-[1440px] mx-auto px-margin-page relative z-10 flex flex-col pt-16 pb-32">
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-center mt-8 lg:mt-16 mb-32">
            <div className="lg:col-span-5 flex flex-col gap-6">
              <span className="inline-flex items-center gap-2 w-fit font-label-caps text-label-caps text-on-primary-container bg-primary-container px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-mint" />
                {t("landing.eyebrow")}
              </span>
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight leading-tight">
                {t("landing.headline1")}<br />
                <span className="bg-brand-gradient bg-clip-text text-transparent">{t("landing.headline2")}</span>
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-md">{t("landing.subhead")}</p>
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <Link to={path(signedIn ? "/app" : "/signin")} className="bg-primary text-on-primary px-8 py-3 rounded hover:bg-on-primary-container hover:-translate-y-0.5 transition-all shadow-elevated flex items-center justify-center font-headline-sm gap-2 no-underline whitespace-nowrap">
                  {signedIn ? t("landing.goToApp") : t("landing.getStarted")}
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
                <Link to={path("/help")} className="bg-transparent text-primary border border-outline-variant px-8 py-3 rounded hover:border-primary hover:bg-primary/5 transition-colors flex items-center justify-center font-headline-sm no-underline whitespace-nowrap">
                  {t("landing.viewDocs")}
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7 mt-12 lg:mt-0 relative group">
              <div className="absolute inset-0 bg-brand-radial-glow blur-2xl rounded-full scale-90 pointer-events-none" />
              <div className="bg-on-surface relative z-10 rounded-xl overflow-hidden flex flex-col shadow-elevated ring-1 ring-white/10 group-hover:-translate-y-1 transition-transform duration-500">
                <div className="bg-surface-variant border-b border-outline-variant/20 px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-error" />
                    <div className="w-3 h-3 rounded-full bg-on-tertiary-container" />
                    <div className="w-3 h-3 rounded-full bg-secondary" />
                  </div>
                  <span className="font-label-caps text-on-surface-variant">Transaction Log</span>
                </div>
                <div className="p-6 font-mono-data text-[14px] flex flex-col gap-4 text-outline-variant/80">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-primary-fixed-dim">01</span>
                      <span className="text-on-primary">&gt;</span>
                      <span className="text-secondary-fixed">agent.call</span>
                      <span className="text-on-primary">(</span>
                      <span className="text-on-tertiary-container">"orders.refund"</span>
                      <span className="text-on-primary">, {"{"} order_id: </span>
                      <span className="text-tertiary-fixed-dim">"ORD-8821A"</span>
                      <span className="text-on-primary"> {"}"})</span>
                    </div>
                    <div className="pl-12 text-outline text-[12px] mt-1">// Invoking canonical refund intent</div>
                  </div>
                  <div className="flex flex-col mt-2 border-l border-outline-variant/30 ml-[23px] pl-6 py-2">
                    <div className="flex items-center gap-3 opacity-80">
                      <span className="text-on-primary">&lt;-</span>
                      <span className="text-outline-variant">policy_response:</span>
                      <span className="text-on-tertiary-container">require_approval</span>
                    </div>
                    <div className="flex items-center gap-3 opacity-80 mt-1">
                      <span className="text-on-primary">-&gt;</span>
                      <span className="text-outline-variant">approval_granted:</span>
                      <span className="text-secondary-fixed">true</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-primary-fixed-dim">02</span>
                    <span className="text-on-primary">&lt;-</span>
                    <span className="text-outline-variant">result:</span>
                    <span className="text-secondary-fixed font-bold bg-secondary/20 px-2 py-0.5 rounded">refund_success</span>
                  </div>
                  <div className="w-2 h-4 bg-primary-fixed-dim mt-2" />
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32 scroll-mt-24">
            {[
              { icon: "integration_instructions", title: t("landing.prop1.title"), body: t("landing.prop1.body"), iconBox: "bg-primary/10 text-primary" },
              { icon: "security", title: t("landing.prop2.title"), body: t("landing.prop2.body"), iconBox: "bg-secondary/10 text-secondary" },
              { icon: "history", title: t("landing.prop3.title"), body: t("landing.prop3.body"), iconBox: "bg-tertiary/10 text-tertiary" },
            ].map((p) => (
              <div key={p.title} className="flex flex-col p-6 bg-surface-container-lowest border border-outline-variant rounded-lg group hover:border-primary/40 hover:shadow-card hover:-translate-y-1 transition-all duration-300">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-6 ${p.iconBox}`}>
                  <span className="material-symbols-outlined text-[24px]">{p.icon}</span>
                </div>
                <h3 className="font-headline-sm text-on-surface mb-3">{p.title}</h3>
                <p className="font-body-md text-on-surface-variant">{p.body}</p>
              </div>
            ))}
          </section>

          <section id="how-it-works" className="mb-32 scroll-mt-24">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="font-label-caps text-label-caps text-primary">{t("landing.howItWorks.eyebrow")}</span>
              <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight mt-2">{t("landing.howItWorks.title")}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
              <div className="hidden md:block absolute top-6 left-0 right-0 h-px bg-outline-variant" />
              {([1, 2, 3, 4] as const).map((n) => (
                <div key={n} className="flex flex-col gap-4 relative">
                  <div className="w-12 h-12 rounded-full bg-brand-gradient text-on-primary flex items-center justify-center font-headline-sm shrink-0 relative z-10 shadow-soft">
                    {n}
                  </div>
                  <h3 className="font-headline-sm text-on-surface">{t(`landing.howItWorks.step${n}.title`)}</h3>
                  <p className="font-body-md text-on-surface-variant">{t(`landing.howItWorks.step${n}.body`)}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="preview" className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-center mb-32 scroll-mt-24">
            <div className="lg:col-span-5 flex flex-col gap-4">
              <span className="font-label-caps text-label-caps text-primary">{t("landing.preview.eyebrow")}</span>
              <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">{t("landing.preview.title")}</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-md">{t("landing.preview.subtitle")}</p>
            </div>
            <div className="lg:col-span-7">
              <ProductPreview />
            </div>
          </section>

          <section id="platforms" className="border-t border-outline-variant pt-16 flex flex-col items-center scroll-mt-24">
            <span className="font-label-caps text-on-surface-variant mb-10 text-center bg-surface px-4 -mt-20 inline-block">{t("landing.supportedPlatforms")}</span>
            <div className="flex flex-col gap-8 w-full">
              {platformsByCategory().map((group) => (
                <div key={group.category} className="flex flex-col items-center gap-4">
                  <span className="font-label-caps text-label-caps text-primary tracking-wide">{CATEGORY_LABEL[group.category][lang]}</span>
                  <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6">
                    {group.platforms.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg px-6 py-4 hover:shadow-card hover:-translate-y-0.5 transition-all">
                        <div className="w-10 h-10 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${p.color}1a`, color: p.color }}>
                          <span className="material-symbols-outlined text-[22px]">{p.icon}</span>
                        </div>
                        <span className="font-headline-sm font-bold tracking-tight text-on-surface-variant">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PublicShell>
  );
}
