import { Fragment } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { PublicShell } from "../components/PublicShell";
import { findArticle } from "../lib/helpArticles";

/** Article bodies write technical tokens as `backtick spans` — render those as inline <code>. */
function renderWithCode(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i} className="font-mono-data text-[14px] bg-surface-container px-1.5 py-0.5 rounded border border-outline-variant/50">
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export default function HelpArticle() {
  const { lang } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? findArticle(slug) : undefined;

  if (!article) return <Navigate to="/help" replace />;

  return (
    <PublicShell>
      <div className="flex flex-col w-full max-w-3xl mx-auto px-margin-page py-margin-page">
        <Link to="/help" className="font-label-caps text-label-caps text-primary flex items-center gap-1 mb-gutter no-underline w-fit">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {lang === "en" ? "Back to Help Center" : "Zurück zum Hilfe-Center"}
        </Link>
        <div className="mb-gutter">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-unit">{article.title[lang]}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {article.readMins} {lang === "en" ? "min read" : "Min. Lesezeit"}
          </p>
        </div>
        <div className="h-[1px] w-full bg-outline-variant mb-margin-page opacity-50" />
        <div className="flex flex-col gap-component-gap">
          {article.body[lang].map((paragraph, i) => (
            <p key={i} className="font-body-lg text-body-lg text-on-surface leading-relaxed">
              {renderWithCode(paragraph)}
            </p>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
