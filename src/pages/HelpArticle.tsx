import { Fragment, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { PublicShell } from "../components/PublicShell";
import { DocsSidebar } from "../components/DocsSidebar";
import { CATEGORY_LABEL, HELP_ARTICLES, findArticle } from "../lib/helpArticles";

/** A copyable, syntax-agnostic code sample — the ` ```lang ... ``` ` fences in an article body
 *  render as this instead of a plain paragraph. */
function CodeBlock({ code }: { code: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  return (
    <div className="relative rounded-lg overflow-hidden bg-inverse-surface">
      <button
        onClick={() => {
          navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }).catch(() => {});
        }}
        className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/20 text-inverse-on-surface/70 hover:text-inverse-on-surface transition-colors border-none font-label-caps text-label-caps"
      >
        <span className="material-symbols-outlined text-[16px]">{copied ? "check" : "content_copy"}</span>
        {copied ? t("action.copied") : t("action.copy")}
      </button>
      <pre className="p-4 pr-24 font-mono-data text-mono-data text-inverse-on-surface overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Article bodies write technical tokens as `backtick spans` — render those as inline <code> — and
 * emphasis as **double-asterisk spans** — render those as <strong>.
 */
function renderWithCode(text: string) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="font-mono-data text-[14px] bg-surface-container px-1.5 py-0.5 rounded border border-outline-variant/50">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function slugifyHeading(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * Groups raw body lines into blocks so a plain string[] can still express structure:
 * - a line starting with "## " becomes a heading
 * - consecutive lines starting with "- " become one bullet list
 * - a "```" line (optionally followed by a language name) opens a code block, consuming lines
 *   verbatim (no `code span`/**bold** parsing inside) until the next "```" line
 * - anything else is a paragraph
 */
type Block =
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "paragraph"; text: string }
  | { type: "code"; text: string };

function groupBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip the closing fence
      blocks.push({ type: "code", text: codeLines.join("\n") });
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "heading", text: line.slice(3) });
    } else if (line.startsWith("- ")) {
      const last = blocks[blocks.length - 1];
      if (last?.type === "list") last.items.push(line.slice(2));
      else blocks.push({ type: "list", items: [line.slice(2)] });
    } else {
      blocks.push({ type: "paragraph", text: line });
    }
    i++;
  }
  return blocks;
}

export default function HelpArticle() {
  const { lang, t, path } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? findArticle(slug) : undefined;

  if (!article) return <Navigate to={path("/help")} replace />;

  const blocks = groupBlocks(article.body[lang]);
  const headings = blocks.filter((b): b is Extract<Block, { type: "heading" }> => b.type === "heading");

  const index = HELP_ARTICLES.findIndex((a) => a.slug === article.slug);
  const prev = index > 0 ? HELP_ARTICLES[index - 1] : undefined;
  const next = index >= 0 && index < HELP_ARTICLES.length - 1 ? HELP_ARTICLES[index + 1] : undefined;

  return (
    <PublicShell>
      <div className="flex flex-row w-full px-gutter md:px-margin-page py-margin-page max-w-7xl mx-auto gap-gutter">
        <DocsSidebar activeSlug={article.slug} />

        <div className="flex flex-col w-full min-w-0 max-w-3xl">
          <div className="flex items-center gap-2 mb-gutter font-label-caps text-label-caps text-on-surface-variant">
            <Link to={path("/help")} className="hover:text-primary no-underline text-on-surface-variant">
              {t("nav.help")}
            </Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span>{CATEGORY_LABEL[article.category][lang]}</span>
          </div>

          <div className="mb-gutter">
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-unit">{article.title[lang]}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {article.readMins} {t("help.minRead")}
            </p>
          </div>
          <div className="h-[1px] w-full bg-outline-variant mb-margin-page opacity-50" />

          <div className="flex flex-col gap-component-gap">
            {blocks.map((block, i) => {
              if (block.type === "heading") {
                return (
                  <h2 key={i} id={slugifyHeading(block.text)} className="font-headline-sm text-headline-sm text-on-surface mt-unit scroll-mt-8">
                    {block.text}
                  </h2>
                );
              }
              if (block.type === "list") {
                return (
                  <ul key={i} className="list-disc pl-5 flex flex-col gap-1">
                    {block.items.map((item, j) => (
                      <li key={j} className="font-body-lg text-body-lg text-on-surface leading-relaxed">
                        {renderWithCode(item)}
                      </li>
                    ))}
                  </ul>
                );
              }
              if (block.type === "code") {
                return <CodeBlock key={i} code={block.text} />;
              }
              return (
                <p key={i} className="font-body-lg text-body-lg text-on-surface leading-relaxed">
                  {renderWithCode(block.text)}
                </p>
              );
            })}
          </div>

          {(prev || next) && (
            <div className="grid grid-cols-2 gap-gutter mt-margin-page pt-gutter border-t border-outline-variant">
              <div>
                {prev && (
                  <Link to={path(`/help/${prev.slug}`)} className="flex flex-col gap-1 p-4 rounded-lg border border-outline-variant hover:border-primary hover:bg-surface-container transition-colors no-underline">
                    <span className="font-label-caps text-label-caps text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                      {t("action.previous")}
                    </span>
                    <span className="font-body-md text-body-md text-on-surface font-medium">{prev.title[lang]}</span>
                  </Link>
                )}
              </div>
              <div>
                {next && (
                  <Link to={path(`/help/${next.slug}`)} className="flex flex-col gap-1 p-4 rounded-lg border border-outline-variant hover:border-primary hover:bg-surface-container transition-colors no-underline text-right items-end">
                    <span className="font-label-caps text-label-caps text-on-surface-variant flex items-center gap-1">
                      {t("action.next")}
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </span>
                    <span className="font-body-md text-body-md text-on-surface font-medium">{next.title[lang]}</span>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {headings.length > 0 && (
          <nav className="hidden xl:block w-56 shrink-0 sticky top-8 self-start">
            <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-2 tracking-wide">
              {t("helpArticle.onThisPage")}
            </h4>
            <ul className="flex flex-col gap-1.5 border-l border-outline-variant">
              {headings.map((h) => (
                <li key={h.text}>
                  <a href={`#${slugifyHeading(h.text)}`} className="block pl-3 -ml-px font-body-md text-body-md text-on-surface-variant hover:text-primary no-underline">
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </PublicShell>
  );
}
