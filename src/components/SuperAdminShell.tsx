import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { mcp } from "../lib/mcp";
import { Icon } from "./AppShell";

const NAV_ITEMS = [
  { to: "/superadmin/overview", icon: "dashboard", key: "superadmin.nav.overview" },
  { to: "/superadmin/organizations", icon: "corporate_fare", key: "superadmin.nav.organizations" },
  { to: "/superadmin/users", icon: "group", key: "superadmin.nav.users" },
  { to: "/superadmin/platforms", icon: "hub", key: "superadmin.nav.platforms" },
  { to: "/superadmin/admins", icon: "shield_person", key: "superadmin.nav.admins" },
  { to: "/superadmin/settings", icon: "settings", key: "superadmin.nav.settings" },
];

/** Shell for the Hub-wide platform-admin area — deliberately separate from AppShell: there's no
 * organization/project to switch between here, every page reaches across all of them. */
export function SuperAdminShell({ children }: { children: ReactNode }) {
  const { lang, setLang, t, path } = useI18n();
  const [navOpen, setNavOpen] = useState(false);
  // A pure platform admin belongs to no organization — /app has nothing for them but a forced
  // "create your own org" onboarding flow, which doesn't make sense for a Hub-wide role. Only show
  // the link back to it when they actually own/belong to at least one org (e.g. an admin who is
  // also a normal org owner elsewhere).
  const [hasOrg, setHasOrg] = useState(false);
  useEffect(() => {
    mcp<{ id: string }[]>("list_my_organizations").then((orgs) => setHasOrg(orgs.length > 0)).catch(() => setHasOrg(false));
  }, []);

  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen">
      {navOpen && <div className="fixed inset-0 bg-on-surface/40 z-40 lg:hidden" onClick={() => setNavOpen(false)} />}

      <aside
        className={
          "fixed left-0 top-0 h-full w-64 bg-inverse-surface text-inverse-on-surface border-r border-outline-variant z-50 flex flex-col transition-transform duration-200 lg:translate-x-0 " +
          (navOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="h-14 px-gutter flex items-center gap-2 border-b border-white/10 mb-unit">
          <img src="/icon.png" alt="" className="h-7 w-7 shrink-0" />
          <span className="font-headline-sm tracking-tight truncate">{t("superadmin.badge")}</span>
        </div>
        <nav className="flex-1 px-unit space-y-unit">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={path(item.to)}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                "flex items-center gap-component-gap px-gutter py-2 rounded-lg transition-colors " +
                (isActive ? "bg-brand-mint/20 text-brand-mint font-bold" : "text-inverse-on-surface/70 hover:bg-white/5")
              }
            >
              <Icon name={item.icon} />
              <span className="text-body-md">{t(item.key)}</span>
            </NavLink>
          ))}
          {hasOrg && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <a href={path("/app")} className="flex items-center gap-component-gap px-gutter py-2 transition-colors text-inverse-on-surface/70 hover:bg-white/5">
                <Icon name="arrow_back" />
                <span className="text-body-md">{t("superadmin.backToHub")}</span>
              </a>
            </div>
          )}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="fixed top-0 left-0 right-0 lg:left-64 h-14 bg-surface border-b border-outline-variant z-30 flex items-center justify-between gap-2 px-gutter">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button onClick={() => setNavOpen(true)} className="lg:hidden shrink-0 -ml-1 p-1 bg-transparent border-none cursor-pointer text-on-surface-variant hover:text-primary" aria-label={t("topbar.openMenu")}>
              <Icon name="menu" size={22} />
            </button>
            <span className="font-headline-sm text-on-surface truncate">{t("superadmin.badge")}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-gutter shrink-0">
            <div className="flex border border-outline-variant rounded overflow-hidden">
              <button onClick={() => setLang("en")} className={"px-2 py-1 text-label-caps font-label-caps " + (lang === "en" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container")}>EN</button>
              <button onClick={() => setLang("de")} className={"px-2 py-1 text-label-caps font-label-caps " + (lang === "de" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container")}>DE</button>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="hidden sm:inline text-body-md text-on-surface-variant hover:text-primary bg-transparent border-none cursor-pointer whitespace-nowrap">
              {t("topbar.signOut")}
            </button>
          </div>
        </header>
        <main className="relative pt-14 min-h-screen bg-background">{children}</main>
      </div>
    </div>
  );
}
