import { useState } from "react";
import { supabase } from "../lib/supabase";
import { mcp } from "../lib/mcp";
import { useI18n } from "../lib/i18n";

export default function Account() {
  const { t } = useI18n();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function exportData() {
    setErr(null);
    setExporting(true);
    try {
      const data = await mcp("export_my_data");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-integration-hub-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErr((e as Error).message); } finally { setExporting(false); }
  }

  async function deleteAccount() {
    setErr(null);
    setDeleting(true);
    try {
      await mcp("delete_my_account");
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e) { setErr((e as Error).message); setDeleting(false); setConfirmOpen(false); }
  }

  return (
    <div className="flex flex-col w-full h-full relative font-body-md text-on-surface">
      <div className="px-margin-page py-gutter flex flex-col gap-margin-page max-w-3xl mx-auto w-full">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{t("account.title")}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-unit">{t("account.subtitle")}</p>
        </div>

        {err && <p className="text-error font-body-md text-body-md">{err}</p>}

        <div className="bg-surface-container-lowest border border-outline-variant rounded p-gutter flex flex-col gap-3">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("account.export.title")}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">{t("account.export.body")}</p>
          <button
            disabled={exporting} onClick={exportData}
            className="self-start bg-primary text-on-primary px-gutter py-2 rounded flex items-center gap-component-gap font-body-md hover:bg-on-primary-container transition-colors disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {exporting ? "…" : t("account.export.button")}
          </button>
        </div>

        <div className="bg-error-container/10 border border-error/30 rounded p-gutter flex flex-col gap-3">
          <h2 className="font-headline-sm text-headline-sm text-error">{t("account.delete.title")}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">{t("account.delete.body")}</p>
          {!confirmOpen ? (
            <button
              onClick={() => setConfirmOpen(true)}
              className="self-start border border-error text-error px-gutter py-2 rounded flex items-center gap-component-gap font-body-md hover:bg-error/5 transition-colors bg-transparent"
            >
              <span className="material-symbols-outlined text-[18px]">person_remove</span>
              {t("account.delete.button")}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                disabled={deleting} onClick={deleteAccount}
                className="bg-error text-on-error px-gutter py-2 rounded font-body-md hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {deleting ? "…" : t("account.delete.confirmButton")}
              </button>
              <button onClick={() => setConfirmOpen(false)} className="px-gutter py-2 text-on-surface-variant font-body-md hover:text-on-surface bg-transparent border-none">
                {t("action.cancel")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
