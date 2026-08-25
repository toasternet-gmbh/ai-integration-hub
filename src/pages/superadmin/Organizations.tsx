import { useEffect, useState } from "react";
import { mcp } from "../../lib/mcp";
import { useI18n } from "../../lib/i18n";

type Org = { id: string; name: string; created_at: string; owner_email: string | null; project_count: number };

export default function SuperAdminOrganizations() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Org[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    mcp<Org[]>("admin_list_organizations", {}).then(setRows).catch((e) => setErr((e as Error).message));
  }, []);

  return (
    <div className="flex flex-col w-full p-margin-page gap-margin-page max-w-7xl mx-auto">
      <div className="flex flex-col gap-unit">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("superadmin.orgs.title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">{t("superadmin.orgs.subtitle")}</p>
      </div>

      {err && <p className="text-error font-body-md text-body-md">{err}</p>}

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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
