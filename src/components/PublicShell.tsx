import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { Icon } from "./AppShell";

export function PublicShell({ children }: { children: ReactNode }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen flex flex-col">
      <header className="h-16 border-b border-outline-variant flex items-center px-margin-page justify-between shrink-0">
        <Link to="/" className="font-headline-sm text-primary uppercase no-underline">AI Integration Hub</Link>
        <nav className="flex gap-gutter items-center">
          <a href="/#features" className="hidden sm:inline text-body-md text-on-surface-variant hover:text-primary transition-colors no-underline">{t("nav.features")}</a>
          <a href="/#platforms" className="hidden sm:inline text-body-md text-on-surface-variant hover:text-primary transition-colors no-underline">{t("nav.platforms")}</a>
          <Link to="/help" className="hidden sm:inline text-body-md text-on-surface-variant hover:text-primary transition-colors no-underline">{t("nav.docs")}</Link>
          <div className="flex border border-outline-variant rounded overflow-hidden">
            <button onClick={() => setLang("en")} className={"px-2 py-1 text-label-caps font-label-caps " + (lang === "en" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container")}>EN</button>
            <button onClick={() => setLang("de")} className={"px-2 py-1 text-label-caps font-label-caps " + (lang === "de" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container")}>DE</button>
          </div>
          <Link to="/signin" className="text-body-md text-on-surface-variant hover:text-primary transition-colors no-underline">{t("landing.signIn")}</Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="w-full border-t border-outline-variant bg-surface-container py-8 shrink-0">
        <div className="max-w-7xl mx-auto px-margin-page flex flex-col md:flex-row justify-between items-center gap-component-gap">
          <div className="flex flex-col">
            <span className="font-headline-sm text-on-surface tracking-tight">Innov-AI-tive GmbH</span>
            <p className="text-label-caps text-on-surface-variant uppercase mt-1">{t("footer.rights")}</p>
          </div>
          <div className="flex gap-gutter">
            <Link to="/imprint" className="text-body-md text-on-surface-variant hover:text-primary no-underline">{t("footer.imprint")}</Link>
            <Link to="/privacy" className="text-body-md text-on-surface-variant hover:text-primary no-underline">{t("footer.privacy")}</Link>
            <Link to="/terms" className="text-body-md text-on-surface-variant hover:text-primary no-underline">{t("footer.terms")}</Link>
            <Link to="/help" className="text-body-md text-on-surface-variant hover:text-primary no-underline">{t("footer.help")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export { Icon };
