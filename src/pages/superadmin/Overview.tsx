import { useEffect, useState } from "react";
import { mcp } from "../../lib/mcp";
import { useI18n } from "../../lib/i18n";

type Org = { id: string; project_count: number };
type PlatformAdmin = { user_id: string };
type Tool = { name: string };
type HubUser = { id: string };

export default function SuperAdminOverview() {
  const { t } = useI18n();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [users, setUsers] = useState<HubUser[]>([]);
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      mcp<Org[]>("admin_list_organizations", {}),
      mcp<HubUser[]>("admin_list_users", {}),
      mcp<PlatformAdmin[]>("admin_list_platform_admins", {}),
      mcp<Tool[]>("admin_list_platforms", {}),
    ]).then(([o, u, a, tl]) => { setOrgs(o); setUsers(u); setAdmins(a); setTools(tl); })
      .catch((e) => setErr((e as Error).message));
  }, []);

  return (
    <div className="flex flex-col w-full p-margin-page gap-margin-page max-w-7xl mx-auto">
      <div className="flex flex-col gap-unit">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("superadmin.overview.title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">{t("superadmin.overview.subtitle")}</p>
      </div>

      {err && <p className="text-error font-body-md text-body-md">{err}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <StatCard label={t("superadmin.overview.organizations")} icon="corporate_fare" value={orgs.length} />
        <StatCard label={t("superadmin.overview.users")} icon="group" value={users.length} />
        <StatCard label={t("superadmin.overview.platformAdmins")} icon="shield_person" value={admins.length} />
        <StatCard label={t("superadmin.overview.tools")} icon="hub" value={tools.length} />
      </div>
    </div>
  );
}

function StatCard({ label, icon, value }: { label: string; icon: string; value: number }) {
  return (
    <div className="flex flex-col rounded-xl p-gutter relative overflow-hidden shadow-soft hover:shadow-card transition-shadow bg-surface-container-lowest text-on-surface-variant border border-outline-variant">
      <div className="flex justify-between items-start mb-4">
        <span className="font-label-caps text-label-caps uppercase tracking-wider">{label}</span>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <span className="font-mono-data text-[32px] font-bold leading-none text-on-surface">{value}</span>
    </div>
  );
}
