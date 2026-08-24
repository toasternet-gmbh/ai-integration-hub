import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { PublicShell } from "../components/PublicShell";

const PLATFORMS = [
  { letter: "W", name: "WooCommerce", soon: false },
  { letter: "S", name: "Shopware 6", soon: false },
  { letter: "S", name: "Shopify", soon: false },
  { letter: "M", name: "Magento", soon: false },
];

export default function Landing() {
  const { t } = useI18n();
  return (
    <PublicShell>
      <div className="relative min-h-screen overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(20,24,31,0.03) 1px, transparent 0)", backgroundSize: "24px 24px" }}
        />
        <div className="max-w-[1440px] mx-auto px-margin-page relative z-10 flex flex-col pt-16 pb-32">
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-center mt-8 lg:mt-16 mb-32">
            <div className="lg:col-span-5 flex flex-col gap-6">
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight leading-tight">
                {t("landing.headline1")}<br />{t("landing.headline2")}
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-md">{t("landing.subhead")}</p>
              <div className="flex gap-4 mt-4">
                <Link to="/signin" className="bg-primary text-on-primary px-8 py-3 rounded hover:bg-primary-container transition-colors flex items-center justify-center font-headline-sm gap-2 no-underline">
                  {t("landing.getStarted")}
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
                <Link to="/help" className="bg-transparent text-primary border border-primary px-8 py-3 rounded hover:bg-primary/5 transition-colors flex items-center justify-center font-headline-sm no-underline">
                  {t("landing.viewDocs")}
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7 mt-12 lg:mt-0 relative group">
              <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full scale-90 pointer-events-none" />
              <div className="bg-on-surface relative z-10 rounded-xl overflow-hidden flex flex-col shadow-xl ring-1 ring-white/10">
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
              { icon: "integration_instructions", title: t("landing.prop1.title"), body: t("landing.prop1.body") },
              { icon: "security", title: t("landing.prop2.title"), body: t("landing.prop2.body") },
              { icon: "history", title: t("landing.prop3.title"), body: t("landing.prop3.body") },
            ].map((p) => (
              <div key={p.title} className="flex flex-col p-6 bg-surface-container-lowest border border-outline-variant rounded-lg group hover:border-primary/50 transition-colors">
                <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center mb-6 text-primary">
                  <span className="material-symbols-outlined text-[24px]">{p.icon}</span>
                </div>
                <h3 className="font-headline-sm text-on-surface mb-3">{p.title}</h3>
                <p className="font-body-md text-on-surface-variant">{p.body}</p>
              </div>
            ))}
          </section>

          <section id="platforms" className="border-t border-outline-variant pt-16 flex flex-col items-center scroll-mt-24">
            <span className="font-label-caps text-on-surface-variant mb-8 text-center bg-surface px-4 -mt-20 inline-block">{t("landing.supportedPlatforms")}</span>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-70">
              {PLATFORMS.map((p) => (
                <div key={p.name} className="flex items-center gap-2 relative">
                  <div className="w-8 h-8 bg-surface-variant rounded flex items-center justify-center font-bold">{p.letter}</div>
                  <span className="font-headline-sm font-bold tracking-tight">{p.name}</span>
                  {p.soon && (
                    <span className="absolute -top-6 -right-2 bg-surface-container text-on-surface-variant font-label-caps px-2 py-1 rounded text-[9px]">
                      {t("integrations.comingSoon").toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PublicShell>
  );
}
