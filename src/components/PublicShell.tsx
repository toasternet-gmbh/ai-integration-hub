import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useSession } from "../lib/useSession";
import { Icon } from "./AppShell";

export function PublicShell({ children }: { children: ReactNode }) {
  const { lang, setLang, t, path } = useI18n();
  const signedIn = useSession();
  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen flex flex-col">
      <header className="h-16 border-b border-outline-variant flex items-center px-margin-page justify-between shrink-0 sticky top-0 z-50 bg-surface/80 backdrop-blur-md">
        <Link to={path("/")} className="flex items-center no-underline">
          <img src="/logo.png" alt="AI Integration Hub" className="h-10 w-auto" />
        </Link>
        <nav className="flex gap-gutter items-center">
          <a href={`${path("/")}#features`} className="hidden lg:inline text-body-md text-on-surface-variant hover:text-primary transition-colors no-underline">{t("nav.features")}</a>
          <a href={`${path("/")}#how-it-works`} className="hidden lg:inline text-body-md text-on-surface-variant hover:text-primary transition-colors no-underline">{t("nav.howItWorks")}</a>
          <a href={`${path("/")}#preview`} className="hidden lg:inline text-body-md text-on-surface-variant hover:text-primary transition-colors no-underline">{t("nav.preview")}</a>
          <a href={`${path("/")}#platforms`} className="hidden lg:inline text-body-md text-on-surface-variant hover:text-primary transition-colors no-underline">{t("nav.platforms")}</a>
          <Link to={path("/help")} className="hidden sm:inline text-body-md text-on-surface-variant hover:text-primary transition-colors no-underline">{t("nav.docs")}</Link>
          <div className="flex border border-outline-variant rounded-full overflow-hidden p-0.5">
            <button onClick={() => setLang("en")} className={"px-2.5 py-1 rounded-full text-label-caps font-label-caps transition-colors " + (lang === "en" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container")}>EN</button>
            <button onClick={() => setLang("de")} className={"px-2.5 py-1 rounded-full text-label-caps font-label-caps transition-colors " + (lang === "de" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container")}>DE</button>
          </div>
          {!signedIn && (
            <Link to={path("/signin")} className="hidden sm:inline text-body-md text-on-surface-variant hover:text-primary transition-colors no-underline">
              {t("landing.signIn")}
            </Link>
          )}
          <Link
            to={path(signedIn ? "/app" : "/connect")}
            className="text-body-md font-medium text-on-primary bg-primary hover:bg-on-primary-container transition-colors no-underline px-4 py-2 rounded-full shadow-soft"
          >
            {signedIn ? t("landing.goToApp") : t("landing.connectCta")}
          </Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="w-full border-t border-outline-variant bg-surface-container py-10 shrink-0 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-brand-gradient opacity-60" />
        <div className="max-w-7xl mx-auto px-margin-page flex flex-col md:flex-row justify-between items-center gap-component-gap">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="" className="h-8 w-8 shrink-0" />
            <div className="flex flex-col">
              <span className="font-headline-sm text-on-surface tracking-tight">Innov-AI-tive GmbH</span>
              <p className="text-label-caps text-on-surface-variant uppercase mt-1">{t("footer.rights")}</p>
            </div>
          </div>
          <div className="flex gap-gutter">
            <Link to={path("/imprint")} className="text-body-md text-on-surface-variant hover:text-primary no-underline">{t("footer.imprint")}</Link>
            <Link to={path("/privacy")} className="text-body-md text-on-surface-variant hover:text-primary no-underline">{t("footer.privacy")}</Link>
            <Link to={path("/terms")} className="text-body-md text-on-surface-variant hover:text-primary no-underline">{t("footer.terms")}</Link>
            <Link to={path("/help")} className="text-body-md text-on-surface-variant hover:text-primary no-underline">{t("footer.help")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export { Icon };
