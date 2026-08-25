import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { CATEGORY_LABEL, CATEGORY_ORDER, HELP_ARTICLES } from "../lib/helpArticles";

/** Left-hand nav shared by the docs index and every article page: all articles, grouped by
 * category, with the current one (if any) highlighted. Hidden below `lg` — narrow viewports fall
 * back to the index page's own search/browse UI. */
export function DocsSidebar({ activeSlug }: { activeSlug?: string }) {
  const { lang, t, path } = useI18n();

  return (
    <nav className="hidden lg:block w-64 shrink-0 sticky top-8 self-start max-h-[calc(100vh-4rem)] overflow-y-auto pb-8">
      <Link
        to={path("/help")}
        className={
          "block font-label-caps text-label-caps mb-4 no-underline " +
          (activeSlug ? "text-on-surface-variant hover:text-primary" : "text-primary")
        }
      >
        {t("nav.help")}
      </Link>
      <div className="flex flex-col gap-6">
        {CATEGORY_ORDER.map((cat) => (
          <div key={cat}>
            <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-2 tracking-wide">
              {CATEGORY_LABEL[cat][lang]}
            </h4>
            <ul className="flex flex-col gap-0.5 border-l border-outline-variant">
              {HELP_ARTICLES.filter((a) => a.category === cat).map((a) => (
                <li key={a.slug}>
                  <Link
                    to={path(`/help/${a.slug}`)}
                    className={
                      "block pl-3 -ml-px py-1 border-l-2 font-body-md text-body-md no-underline transition-colors " +
                      (a.slug === activeSlug
                        ? "border-primary text-primary font-medium"
                        : "border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant")
                    }
                  >
                    {a.title[lang]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
