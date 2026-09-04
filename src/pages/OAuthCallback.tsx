import { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { mcp } from "../lib/mcp";
import { useI18n } from "../lib/i18n";

type Ctx = { projectId: string };

/** Where outlook/google redirect the browser back to after the user consents —
 * `?state=<integration_id>&code=<code>` (see tools/oauthConnections.ts's start_oauth_connection:
 * the OAuth `state` is the integration's own id, same trick BankCallback.tsx uses for GoCardless's
 * requisition `reference`). Finalizes the connection, then hands off to the normal Integrations
 * page. Generic across providers — unlike BankCallback.tsx, this page never needs to know which
 * platform it's completing; tools/oauthConnections.ts looks that up from the integration row. */
export default function OAuthCallback() {
  const { projectId } = useOutletContext<Ctx>();
  const { t, path } = useI18n();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const state = searchParams.get("state");
    const code = searchParams.get("code");
    const providerError = searchParams.get("error_description") ?? searchParams.get("error");
    if (providerError) { setStatus("error"); setMessage(providerError); return; }
    if (!state || !code) { setStatus("error"); setMessage(t("integrations.oauthCallbackMissingParams")); return; }
    const redirectUrl = `${window.location.origin}${window.location.pathname}`;
    mcp<{ status: string; error_status: string | null }>(
      "complete_oauth_connection",
      { integration_id: state, code, redirect_url: redirectUrl },
      { projectId },
    )
      .then((updated) => {
        if (updated.status === "connected") { setStatus("ok"); return; }
        setStatus("error");
        setMessage(updated.error_status ?? updated.status);
      })
      .catch((e) => { setStatus("error"); setMessage((e as Error).message); });
  }, [searchParams, projectId, t]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-margin-page text-center">
      {status === "pending" && <p className="font-body-md text-body-md text-on-surface-variant">{t("integrations.oauthCallbackPending")}</p>}
      {status === "ok" && <p className="font-body-md text-body-md text-secondary">{t("integrations.oauthCallbackOk")}</p>}
      {status === "error" && <p className="font-body-md text-body-md text-error">{message}</p>}
      <a href={path("/app/integrations")} className="text-primary font-label-caps text-label-caps underline">
        {t("integrations.title").toUpperCase()}
      </a>
    </div>
  );
}
