import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { usePlatformAdmin } from "../lib/usePlatformAdmin";

const NAV_ITEMS = [
  { to: "/app/dashboard", icon: "grid_view", key: "nav.dashboard" },
  { to: "/app/integrations", icon: "hub", key: "nav.integrations" },
  { to: "/app/agents", icon: "shield_person", key: "nav.agents" },
  { to: "/app/approvals", icon: "fact_check", key: "nav.approvals" },
  { to: "/app/audit", icon: "history_edu", key: "nav.audit" },
  { to: "/app/api-keys", icon: "vpn_key", key: "nav.apiKeys" },
  { to: "/app/billing", icon: "credit_card", key: "nav.billing" },
  { to: "/app/team", icon: "group", key: "nav.team" },
  { to: "/app/account", icon: "account_circle", key: "nav.account" },
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>;
}

export function AppShell({
  orgName, projectName, onSwitchProject, children,
}: { orgName: string; projectName: string; onSwitchProject: () => void; children: ReactNode }) {
  const { lang, setLang, t, path } = useI18n();
  const [navOpen, setNavOpen] = useState(false);
  const isPlatformAdmin = usePlatformAdmin();

  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen">
      {navOpen && (
        <div
          className="fixed inset-0 bg-on-surface/40 z-40 lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        className={
          "fixed left-0 top-0 h-full w-64 bg-surface-container-low border-r border-outline-variant z-50 flex flex-col transition-transform duration-200 lg:translate-x-0 " +
          (navOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="h-14 px-gutter flex items-center gap-2 border-b border-outline-variant mb-unit">
          <img src="/icon.png" alt="" className="h-7 w-7 shrink-0" />
          <span className="font-headline-sm text-on-surface tracking-tight truncate">AI Integration Hub</span>
        </div>
        <nav className="flex-1 px-unit space-y-unit">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={path(item.to)}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                "flex items-center gap-component-gap px-gutter py-2 rounded-lg transition-colors " +
                (isActive
                  ? "bg-primary-container text-on-primary-container font-bold"
                  : "text-on-surface-variant hover:bg-surface-container-high")
              }
            >
              <Icon name={item.icon} />
              <span className="text-body-md">{t(item.key)}</span>
            </NavLink>
          ))}
          <div className="mt-4 pt-4 border-t border-outline-variant">
            <a
              href={path("/help")}
              className="flex items-center gap-component-gap px-gutter py-2 transition-colors text-on-surface-variant hover:bg-surface-container-high"
            >
              <Icon name="help_center" />
              <span className="text-body-md">{t("nav.help")}</span>
            </a>
            {isPlatformAdmin && (
              <a
                href={path("/superadmin")}
                className="flex items-center gap-component-gap px-gutter py-2 mt-unit rounded-lg transition-colors text-brand-mint hover:bg-secondary/10"
              >
                <Icon name="shield_person" />
                <span className="text-body-md font-medium">{t("superadmin.badge")}</span>
              </a>
            )}
          </div>
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="fixed top-0 left-0 right-0 lg:left-64 h-14 bg-surface border-b border-outline-variant z-30 flex items-center justify-between gap-2 px-gutter">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={() => setNavOpen(true)}
              className="lg:hidden shrink-0 -ml-1 p-1 bg-transparent border-none cursor-pointer text-on-surface-variant hover:text-primary"
              aria-label={t("topbar.openMenu")}
            >
              <Icon name="menu" size={22} />
            </button>
            <div className="flex items-center gap-unit text-on-surface-variant text-body-md min-w-0">
              <button onClick={onSwitchProject} className="hover:text-primary cursor-pointer bg-transparent border-none p-0 font-body-md text-body-md text-on-surface-variant truncate">{orgName}</button>
              <Icon name="chevron_right" size={16} />
              <span className="text-on-surface font-bold truncate">{projectName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-gutter shrink-0">
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
            <div className="flex items-center gap-component-gap border-l border-outline-variant pl-2 sm:pl-gutter">
              <button onClick={() => supabase.auth.signOut()} className="hidden sm:inline text-body-md text-on-surface-variant hover:text-primary bg-transparent border-none cursor-pointer whitespace-nowrap">
                {t("topbar.signOut")}
              </button>
              <button onClick={() => supabase.auth.signOut()} aria-label={t("topbar.signOut")} className="sm:hidden p-1 bg-transparent border-none cursor-pointer text-on-surface-variant hover:text-primary">
                <Icon name="logout" size={20} />
              </button>
              <div className="w-8 h-8 rounded-full bg-brand-gradient text-on-primary flex items-center justify-center shrink-0">
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
