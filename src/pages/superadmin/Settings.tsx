import { useEffect, useState } from "react";
import { mcp } from "../../lib/mcp";
import { useI18n } from "../../lib/i18n";

type Setting = { key: string; value: unknown; updated_at: string };

export default function SuperAdminSettings() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Setting[]>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function reload() {
    return mcp<Setting[]>("admin_get_settings", {}).then(setRows).catch((e) => setErr((e as Error).message));
  }
  useEffect(() => { reload(); }, []);

  async function save() {
    if (!key.trim()) return;
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch { setErr(t("superadmin.settings.invalidJson")); return; }
    setErr(null);
    setBusy(true);
    try { await mcp("admin_set_setting", { key: key.trim(), value: parsed }); setKey(""); setValue(""); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col w-full p-margin-page gap-margin-page max-w-7xl mx-auto">
      <div className="flex flex-col gap-unit">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("superadmin.settings.title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">{t("superadmin.settings.subtitle")}</p>
      </div>

      {err && <p className="text-error font-body-md text-body-md">{err}</p>}

      <div className="flex flex-col sm:flex-row gap-2">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder={t("superadmin.settings.keyPlaceholder")} className="px-3 py-2 border border-outline-variant rounded font-mono-data text-mono-data bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={t("superadmin.settings.valuePlaceholder")} className="flex-1 px-3 py-2 border border-outline-variant rounded font-mono-data text-mono-data bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" />
        <button disabled={busy} onClick={save} className="shrink-0 whitespace-nowrap bg-primary text-on-primary px-gutter py-2 rounded flex items-center justify-center gap-component-gap font-body-md hover:bg-on-primary-container transition-colors disabled:opacity-60">
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t("superadmin.settings.add")}
        </button>
      </div>

      <div className="bg-surface-container-lowest flex flex-col rounded border border-outline-variant">
        {rows.length === 0 && <div className="px-gutter py-6 text-on-surface-variant font-body-md text-body-md">{t("superadmin.settings.empty")}</div>}
        {rows.map((s) => (
          <div key={s.key} className="flex flex-col sm:flex-row sm:items-center gap-2 px-gutter py-4 border-b border-outline-variant last:border-b-0">
            <span className="font-mono-data text-mono-data text-primary sm:w-1/3 shrink-0">{s.key}</span>
            <span className="font-mono-data text-[13px] text-on-surface break-all">{JSON.stringify(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
