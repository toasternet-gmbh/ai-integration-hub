import { Navigate } from "react-router-dom";
import { PublicShell } from "../components/PublicShell";
import { PlatformPicker } from "../components/PlatformPicker";
import { useI18n } from "../lib/i18n";
import { useSession } from "../lib/useSession";

/** The dedicated entry point for "connect a platform" — reachable directly from the header CTA
 * and the landing hero, without scrolling through the rest of the marketing page first. */
export default function Connect() {
  const { t, path } = useI18n();
  const signedIn = useSession();

  // Already signed in -- picking a platform here would just re-derive what Integrations already
  // does with an org/project in hand, so skip straight there instead.
  if (signedIn) return <Navigate to={path("/app/integrations")} replace />;

  return (
    <PublicShell>
      <div className="max-w-5xl mx-auto px-margin-page py-margin-page">
        <div className="max-w-2xl mb-10">
          <span className="font-label-caps text-label-caps text-primary">{t("quickConnect.eyebrow")}</span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-2 mb-3">{t("connect.title")}</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">{t("connect.subtitle")}</p>
        </div>
        <PlatformPicker />
      </div>
    </PublicShell>
  );
}
