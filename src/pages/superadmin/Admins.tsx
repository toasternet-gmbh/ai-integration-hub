import { useEffect, useState } from "react";
import { mcp } from "../../lib/mcp";
import { useI18n } from "../../lib/i18n";

type Admin = { user_id: string; email: string | null; created_at: string };

export default function SuperAdminAdmins() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Admin[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function reload() {
    return mcp<Admin[]>("admin_list_platform_admins", {}).then(setRows).catch((e) => setErr((e as Error).message));
  }
  useEffect(() => { reload(); }, []);

  async function grant() {
    if (!email.trim()) return;
    setErr(null);
    setBusy(true);
    try { await mcp("admin_grant_platform_admin", { email: email.trim() }); setEmail(""); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function revoke(userId: string) {
    setErr(null);
    setBusy(true);
    try { await mcp("admin_revoke_platform_admin", { user_id: userId }); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col w-full p-margin-page gap-margin-page max-w-7xl mx-auto">
      <div className="flex flex-col gap-unit">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("superadmin.admins.title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">{t("superadmin.admins.subtitle")}</p>
      </div>

      {err && <p className="text-error font-body-md text-body-md">{err}</p>}

      <div className="flex flex-col sm:flex-row gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") grant(); }} placeholder={t("superadmin.admins.emailPlaceholder")} type="email" className="flex-1 px-3 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" />
        <button disabled={busy} onClick={grant} className="shrink-0 whitespace-nowrap bg-primary text-on-primary px-gutter py-2 rounded flex items-center justify-center gap-component-gap font-body-md hover:bg-on-primary-container transition-colors disabled:opacity-60">
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          {t("superadmin.admins.grant")}
        </button>
      </div>

      <div className="bg-surface-container-lowest flex flex-col rounded border border-outline-variant">
        {rows.map((a) => (
          <div key={a.user_id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-gutter py-4 border-b border-outline-variant last:border-b-0 hover:bg-surface-container transition-colors">
            <div className="flex items-center gap-component-gap min-w-0">
              <div className="w-8 h-8 shrink-0 rounded-full bg-brand-gradient flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] text-on-primary">shield_person</span>
              </div>
              <div className="min-w-0">
                <div className="font-body-md text-body-md font-bold text-on-surface truncate">{a.email ?? a.user_id}</div>
                <div className="font-mono-data text-[12px] text-on-surface-variant">{t("superadmin.admins.since")} {new Date(a.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <button disabled={busy} onClick={() => revoke(a.user_id)} className="shrink-0 px-3 py-1.5 border border-error/50 text-error hover:bg-error/5 font-label-caps text-label-caps rounded transition-colors disabled:opacity-60">
              {t("superadmin.admins.revoke")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
