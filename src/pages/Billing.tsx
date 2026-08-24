import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { createCheckoutSession, createPortalSession, getSubscription, type Subscription } from "../lib/billing";
import { useI18n } from "../lib/i18n";

type Ctx = { projectId: string; organizationId: string };

export default function Billing() {
  const { organizationId } = useOutletContext<Ctx>();
  const { t } = useI18n();
  const [sub, setSub] = useState<Subscription>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getSubscription(organizationId)
      .then(setSub)
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, [organizationId]);

  async function upgrade() {
    setErr(null);
    setWorking(true);
    try {
      const url = await createCheckoutSession(organizationId);
      window.location.href = url;
    } catch (e) { setErr((e as Error).message); setWorking(false); }
  }

  async function manage() {
    setErr(null);
    setWorking(true);
    try {
      const url = await createPortalSession(organizationId);
      window.location.href = url;
    } catch (e) { setErr((e as Error).message); setWorking(false); }
  }

  const isPro = sub?.plan === "pro" && sub.status !== "canceled";

  return (
    <div className="flex flex-col w-full h-full relative font-body-md text-on-surface">
      <div className="px-margin-page py-gutter flex flex-col gap-margin-page max-w-3xl mx-auto w-full">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{t("billing.title")}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-unit">{t("billing.subtitle")}</p>
        </div>

        {err && <p className="text-error font-body-md text-body-md">{err}</p>}

        {loading ? (
          <p className="text-on-surface-variant">…</p>
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant rounded p-gutter flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  {isPro ? t("billing.plan.pro") : t("billing.plan.free")}
                </h2>
                {sub && (
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                    {t("billing.status")}: {sub.status}
                    {sub.current_period_end && ` · ${t("billing.renews")} ${new Date(sub.current_period_end).toLocaleDateString()}`}
                  </p>
                )}
              </div>
            </div>

            {isPro ? (
              <button
                disabled={working} onClick={manage}
                className="self-start bg-primary text-on-primary px-gutter py-2 rounded flex items-center gap-component-gap font-body-md hover:bg-primary-container transition-colors disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">credit_card</span>
                {working ? "…" : t("billing.manageButton")}
              </button>
            ) : (
              <button
                disabled={working} onClick={upgrade}
                className="self-start bg-primary text-on-primary px-gutter py-2 rounded flex items-center gap-component-gap font-body-md hover:bg-primary-container transition-colors disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">upgrade</span>
                {working ? "…" : t("billing.upgradeButton")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
