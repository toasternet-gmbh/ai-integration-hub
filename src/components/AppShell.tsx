import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";

const NAV_ITEMS = [
  { to: "/app/dashboard", icon: "grid_view", key: "nav.dashboard" },
  { to: "/app/integrations", icon: "hub", key: "nav.integrations" },
  { to: "/app/agents", icon: "shield_person", key: "nav.agents" },
  { to: "/app/approvals", icon: "fact_check", key: "nav.approvals" },
  { to: "/app/audit", icon: "history_edu", key: "nav.audit" },
  { to: "/app/api-keys", icon: "vpn_key", key: "nav.apiKeys" },
  { to: "/app/team", icon: "group", key: "nav.team" },
  { to: "/app/account", icon: "account_circle", key: "nav.account" },
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>;
}

export function AppShell({
  orgName, projectName, onSwitchProject, children,
}: { orgName: string; projectName: string; onSwitchProject: () => void; children: ReactNode }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen">
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-low border-r border-outline-variant z-50 flex flex-col">
        <div className="h-14 px-gutter flex items-center border-b border-outline-variant mb-unit">
          <span className="font-headline-sm text-primary tracking-tight">AI Integration Hub</span>
        </div>
        <nav className="flex-1 px-unit space-y-unit">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                "flex items-center gap-component-gap px-gutter py-2 transition-colors " +
                (isActive
                  ? "bg-primary-container text-on-primary-container font-bold border-l-4 border-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high")
              }
            >
              <Icon name={item.icon} />
              <span className="text-body-md">{t(item.key)}</span>
            </NavLink>
          ))}
          <div className="mt-4 pt-4 border-t border-outline-variant">
            <a
              href="/help"
              className="flex items-center gap-component-gap px-gutter py-2 transition-colors text-on-surface-variant hover:bg-surface-container-high"
            >
              <Icon name="help_center" />
              <span className="text-body-md">{t("nav.help")}</span>
            </a>
          </div>
        </nav>
      </aside>

      <div className="pl-64">
        <header className="fixed top-0 left-64 right-0 h-14 bg-surface border-b border-outline-variant z-40 flex items-center justify-between px-gutter">
          <div className="flex items-center gap-unit text-on-surface-variant text-body-md">
            <button onClick={onSwitchProject} className="hover:text-primary cursor-pointer bg-transparent border-none p-0 font-body-md text-body-md text-on-surface-variant">{orgName}</button>
            <Icon name="chevron_right" size={16} />
            <span className="text-on-surface font-bold">{projectName}</span>
          </div>
          <div className="flex items-center gap-gutter">
            <div className="flex border border-outline-variant rounded overflow-hidden">
              <button
                onClick={() => setLang("en")}
                className={"px-2 py-1 text-label-caps font-label-caps " + (lang === "en" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container")}
              >EN</button>
              <button
                onClick={() => setLang("de")}
                className={"px-2 py-1 text-label-caps font-label-caps " + (lang === "de" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container")}
              >DE</button>
            </div>
            <div className="flex items-center gap-component-gap border-l border-outline-variant pl-gutter">
              <button onClick={() => supabase.auth.signOut()} className="text-body-md text-on-surface-variant hover:text-primary bg-transparent border-none cursor-pointer">
                {t("topbar.signOut")}
              </button>
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Icon name="person" size={18} />
              </div>
            </div>
          </div>
        </header>
        <main className="relative pt-14 min-h-screen bg-background">{children}</main>
      </div>
    </div>
  );
}

export { Icon };
