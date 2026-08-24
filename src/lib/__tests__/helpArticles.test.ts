import { describe, expect, it } from "vitest";
import { HELP_ARTICLES, findArticle } from "../helpArticles";

describe("helpArticles", () => {
  it("has a non-empty catalog", () => {
    expect(HELP_ARTICLES.length).toBeGreaterThan(0);
  });

  it("has no duplicate slugs (a collision would silently shadow one article in findArticle)", () => {
    const slugs = HELP_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(HELP_ARTICLES.map((a) => [a.slug, a] as const))("article '%s' has non-empty EN/DE title, summary, and body", (_slug, article) => {
    expect(article.title.en.trim().length).toBeGreaterThan(0);
    expect(article.title.de.trim().length).toBeGreaterThan(0);
    expect(article.summary.en.trim().length).toBeGreaterThan(0);
    expect(article.summary.de.trim().length).toBeGreaterThan(0);
    expect(article.body.en.length).toBeGreaterThan(0);
    expect(article.body.de.length).toBeGreaterThan(0);
    expect(article.body.en.length).toBe(article.body.de.length);
    expect(article.readMins).toBeGreaterThan(0);
  });

  it("findArticle returns the matching article by slug", () => {
    const first = HELP_ARTICLES[0];
    expect(findArticle(first.slug)).toBe(first);
  });

  it("findArticle returns undefined for an unknown slug", () => {
    expect(findArticle("does-not-exist")).toBeUndefined();
  });
});
