import { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { mcp } from "../lib/mcp";
import { useI18n } from "../lib/i18n";

type Ctx = { projectId: string };

/** Where GoCardless redirects the browser back to after the user consents at their bank —
 * `?ref=<integration_id>` (see tools/banking.ts's start_bank_connection: the requisition's
 * `reference` is the integration's own id). Finalizes the connection, then hands off to the
 * normal Integrations page. */
export default function BankCallback() {
  const { projectId } = useOutletContext<Ctx>();
  const { t, path } = useI18n();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) { setStatus("error"); setMessage(t("integrations.bankCallbackMissingRef")); return; }
    mcp<{ status: string; error_status: string | null }>("complete_bank_connection", { integration_id: ref }, { projectId })
      .then((updated) => {
        if (updated.status === "connected") { setStatus("ok"); return; }
        setStatus("error");
        setMessage(updated.error_status ?? updated.status);
      })
      .catch((e) => { setStatus("error"); setMessage((e as Error).message); });
  }, [searchParams, projectId, t]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-margin-page text-center">
      {status === "pending" && <p className="font-body-md text-body-md text-on-surface-variant">{t("integrations.bankCallbackPending")}</p>}
      {status === "ok" && <p className="font-body-md text-body-md text-secondary">{t("integrations.bankCallbackOk")}</p>}
      {status === "error" && <p className="font-body-md text-body-md text-error">{message}</p>}
      <a href={path("/app/integrations")} className="text-primary font-label-caps text-label-caps underline">
        {t("integrations.title").toUpperCase()}
      </a>
    </div>
  );
}
