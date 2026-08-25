import { useEffect, useState } from "react";
import { mcp } from "../../lib/mcp";
import { useI18n } from "../../lib/i18n";

type Org = { id: string; name: string; created_at: string; owner_email: string | null; project_count: number };

export default function SuperAdminOrganizations() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Org[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

  function reload() {
    return mcp<Org[]>("admin_list_organizations", {}).then(setRows).catch((e) => setErr((e as Error).message));
  }
  useEffect(() => { reload(); }, []);

  async function create() {
    if (!name.trim() || !ownerEmail.trim()) return;
    setErr(null);
    setBusy(true);
    try { await mcp("admin_create_organization", { name: name.trim(), owner_email: ownerEmail.trim() }); setName(""); setOwnerEmail(""); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function rename(org: Org) {
    const next = window.prompt(t("superadmin.orgs.renamePrompt").replace("{name}", org.name), org.name);
    if (!next || !next.trim() || next.trim() === org.name) return;
    setErr(null);
    setBusy(true);
    try { await mcp("admin_rename_organization", { organization_id: org.id, name: next.trim() }); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(org: Org) {
    if (!window.confirm(t("superadmin.orgs.deleteConfirm").replace("{name}", org.name))) return;
    setErr(null);
    setBusy(true);
    try { await mcp("admin_delete_organization", { organization_id: org.id }); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col w-full p-margin-page gap-margin-page max-w-7xl mx-auto">
      <div className="flex flex-col gap-unit">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("superadmin.orgs.title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">{t("superadmin.orgs.subtitle")}</p>
      </div>

      {err && <p className="text-error font-body-md text-body-md">{err}</p>}

      <div className="flex flex-col sm:flex-row gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("superadmin.orgs.namePlaceholder")} className="flex-1 px-3 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" />
        <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }} placeholder={t("superadmin.orgs.ownerEmailPlaceholder")} type="email" className="flex-1 px-3 py-2 border border-outline-variant rounded font-body-md text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" />
        <button disabled={busy} onClick={create} className="shrink-0 whitespace-nowrap bg-primary text-on-primary px-gutter py-2 rounded flex items-center justify-center gap-component-gap font-body-md hover:bg-on-primary-container transition-colors disabled:opacity-60">
          <span className="material-symbols-outlined text-[18px]">add_business</span>
          {t("superadmin.orgs.create")}
        </button>
      </div>

      <div className="bg-surface-container-lowest flex flex-col rounded border border-outline-variant">
        {rows.length === 0 && <div className="px-gutter py-6 text-on-surface-variant font-body-md text-body-md">{t("superadmin.orgs.empty")}</div>}
        {rows.map((org) => (
          <div key={org.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-gutter py-4 border-b border-outline-variant last:border-b-0 hover:bg-surface-container transition-colors">
            <div className="flex items-center gap-component-gap min-w-0">
              <div className="w-8 h-8 shrink-0 rounded bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] text-on-primary-container">corporate_fare</span>
              </div>
              <div className="min-w-0">
                <div className="font-body-md text-body-md font-bold text-on-surface truncate">{org.name}</div>
                <div className="font-mono-data text-[12px] text-on-surface-variant truncate">{org.owner_email ?? "—"}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0 text-body-md text-on-surface-variant">
              <span>{org.project_count} {t("superadmin.orgs.projects")}</span>
              <span className="font-mono-data text-[12px]">{new Date(org.created_at).toLocaleDateString()}</span>
              <button disabled={busy} onClick={() => rename(org)} className="px-3 py-1.5 border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary font-label-caps text-label-caps rounded transition-colors disabled:opacity-60">
                {t("superadmin.orgs.rename")}
              </button>
              <button disabled={busy} onClick={() => remove(org)} className="px-3 py-1.5 border border-error/50 text-error hover:bg-error/5 font-label-caps text-label-caps rounded transition-colors disabled:opacity-60">
                {t("superadmin.orgs.delete")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
