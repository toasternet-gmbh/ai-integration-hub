import { useI18n } from "../lib/i18n";

const NAV_ICONS = ["grid_view", "hub", "shield_person", "fact_check", "history_edu", "vpn_key"];

/**
 * Static, non-interactive mockup of the real Approvals inbox (see src/pages/Approvals.tsx) for the
 * marketing site — deliberately reuses the same layout/tokens as AppShell + the pending-approval
 * card so it reads as an honest screenshot of the product, not an invented illustration.
 */
export function ProductPreview() {
  const { t } = useI18n();

  return (
    <div className="rounded-xl overflow-hidden shadow-xl ring-1 ring-outline-variant/50 bg-surface-container-lowest">
      <div className="bg-surface-variant border-b border-outline-variant/40 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-error" />
          <div className="w-3 h-3 rounded-full bg-on-tertiary-container" />
          <div className="w-3 h-3 rounded-full bg-secondary" />
        </div>
        <span className="font-label-caps text-on-surface-variant">AI Integration Hub — Approvals</span>
        <span className="w-[54px]" />
      </div>

      <div className="flex">
        <div className="hidden sm:flex w-14 shrink-0 bg-surface-container-low border-r border-outline-variant flex-col items-center py-4 gap-3">
          {NAV_ICONS.map((icon, i) => (
            <div
              key={icon}
              className={
                "w-9 h-9 rounded flex items-center justify-center " +
                (i === 3 ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant")
              }
            >
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 p-6 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="font-headline-sm text-headline-sm text-on-surface">{t("preview.approvalsLabel")}</h4>
            <span className="bg-primary text-on-primary text-[11px] font-bold px-2 py-0.5 rounded-full">1</span>
          </div>

          <div className="bg-surface border border-outline-variant rounded flex flex-col">
            <div className="px-5 py-4 border-b border-outline-variant flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">support_agent</span>
                </div>
                <div className="flex flex-col gap-1 mt-0.5">
                  <span className="font-mono-data text-mono-data text-primary px-1.5 py-0.5 bg-primary-fixed-dim/20 rounded w-fit">orders.refund</span>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-surface-variant border border-outline-variant/30 h-[24px] shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container" />
                <span className="font-label-caps text-label-caps text-on-surface uppercase whitespace-nowrap">
                  {t("approvals.awaitingDecision")}
                </span>
              </div>
            </div>

            <div className="px-5 py-4 flex flex-col gap-3">
              <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                {t("preview.refundOrderDemo")}
              </p>
              <div className="flex flex-col gap-1.5 p-3 bg-surface-container rounded border border-outline-variant/50 border-l-4 border-l-tertiary-fixed-dim">
                <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">
                  {t("preview.reasonLabel")}
                </span>
                <p className="font-body-md text-body-md text-on-surface italic">
                  {t("preview.reasonQuote")}
                </p>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-outline-variant flex items-center gap-3">
              <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded font-headline-sm text-[14px]">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {t("preview.approveRun")}
              </div>
              <div className="flex items-center justify-center gap-2 px-4 py-2 bg-transparent text-error border border-error/50 rounded font-headline-sm text-[14px]">
                <span className="material-symbols-outlined text-[18px]">block</span>
                {t("action.deny")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
