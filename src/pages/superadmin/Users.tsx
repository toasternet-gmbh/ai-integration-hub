import { useEffect, useState } from "react";
import { mcp } from "../../lib/mcp";
import { useI18n } from "../../lib/i18n";

type HubUser = { id: string; email: string | null; created_at: string; last_sign_in_at: string | null; banned: boolean };
type Org = { id: string; name: string };

export default function SuperAdminUsers() {
  const { t } = useI18n();
  const [rows, setRows] = useState<HubUser[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgId, setOrgId] = useState("");
  const [role, setRole] = useState<"owner" | "member">("member");

  function reload() {
    return mcp<HubUser[]>("admin_list_users", {}).then(setRows).catch((e) => setErr((e as Error).message));
  }
  useEffect(() => {
    reload();
    mcp<Org[]>("admin_list_organizations", {}).then(setOrgs).catch(() => {});
  }, []);

  async function create() {
    if (!email.trim() || !password) return;
    setErr(null);
    setBusy(true);
    try {
      await mcp("admin_create_user", { email: email.trim(), password, organization_id: orgId || undefined, role: orgId ? role : undefined });
      setEmail(""); setPassword(""); setOrgId(""); setRole("member");
      await reload();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function toggleBan(u: HubUser) {
    setBusyId(u.id);
    setErr(null);
    try { await mcp("admin_set_user_banned", { user_id: u.id, banned: !u.banned }); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusyId(null); }
  }

  async function remove(u: HubUser) {
    if (!window.confirm(t("superadmin.users.deleteConfirm").replace("{email}", u.email ?? u.id))) return;
    setBusyId(u.id);
    setErr(null);
    try { await mcp("admin_delete_user", { user_id: u.id }); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusyId(null); }
  }

  return (
    <div className="flex flex-col w-full p-margin-page gap-margin-page max-w-7xl mx-auto">
      <div className="flex flex-col gap-unit">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("superadmin.users.title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">{t("superadmin.users.subtitle")}</p>
      </div>

      {err && <p className="text-error font-body-md text-body-md">{err}</p>}

      <div className="flex flex-col sm:flex-row gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("superadmin.users.emailPlaceholder")} type="email" className="flex-1 px-3 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }} placeholder={t("superadmin.users.passwordPlaceholder")} type="text" className="flex-1 px-3 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" />
        <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="px-3 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary">
          <option value="">{t("superadmin.users.noOrg")}</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {orgId && (
          <select value={role} onChange={(e) => setRole(e.target.value as "owner" | "member")} className="px-3 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary">
            <option value="member">{t("superadmin.users.roleMember")}</option>
            <option value="owner">{t("superadmin.users.roleOwner")}</option>
          </select>
        )}
        <button disabled={busy} onClick={create} className="shrink-0 whitespace-nowrap bg-primary text-on-primary px-gutter py-2 rounded flex items-center justify-center gap-component-gap font-body-md hover:bg-on-primary-container transition-colors disabled:opacity-60">
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          {t("superadmin.users.create")}
        </button>
      </div>

      <div className="bg-surface-container-lowest flex flex-col rounded border border-outline-variant">
        {rows.length === 0 && <div className="px-gutter py-6 text-on-surface-variant font-body-md text-body-md">{t("superadmin.users.empty")}</div>}
        {rows.map((u) => (
          <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-gutter py-4 border-b border-outline-variant last:border-b-0 hover:bg-surface-container transition-colors">
            <div className="flex-1 flex items-center gap-component-gap min-w-0">
              <div className="w-8 h-8 shrink-0 rounded-full bg-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] text-on-secondary-container">person</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-body-md text-body-md font-bold text-on-surface truncate">{u.email ?? u.id}</span>
                  {u.banned && (
                    <span className="font-label-caps text-label-caps text-on-error-container bg-error-container px-2 py-0.5 rounded-full whitespace-nowrap">{t("superadmin.users.banned")}</span>
                  )}
                </div>
                <div className="font-mono-data text-[12px] text-on-surface-variant">
                  {t("superadmin.users.lastSignIn")}: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : t("superadmin.users.never")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                disabled={busyId === u.id}
                onClick={() => toggleBan(u)}
                className="px-3 py-1.5 border border-outline-variant text-on-surface-variant hover:border-tertiary hover:text-tertiary font-label-caps text-label-caps rounded transition-colors disabled:opacity-60"
              >
                {u.banned ? t("superadmin.users.unban") : t("superadmin.users.ban")}
              </button>
              <button
                disabled={busyId === u.id}
                onClick={() => remove(u)}
                className="px-3 py-1.5 border border-error/50 text-error hover:bg-error/5 font-label-caps text-label-caps rounded transition-colors disabled:opacity-60"
              >
                {t("superadmin.users.delete")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
