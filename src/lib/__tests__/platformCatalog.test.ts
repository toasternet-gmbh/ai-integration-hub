import { describe, expect, it } from "vitest";
import { CATEGORY_LABEL, CATEGORY_ORDER, PLATFORM_CATALOG, platformsByCategory } from "../platformCatalog";

describe("platformCatalog", () => {
  it("has a non-empty catalog", () => {
    expect(PLATFORM_CATALOG.length).toBeGreaterThan(0);
  });

  it("has no duplicate platform ids", () => {
    const ids = PLATFORM_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every platform's category is in CATEGORY_ORDER (and has a label)", () => {
    for (const p of PLATFORM_CATALOG) {
      expect(CATEGORY_ORDER).toContain(p.category);
      expect(CATEGORY_LABEL[p.category]).toBeDefined();
    }
  });

  it.each(PLATFORM_CATALOG.map((p) => [p.id, p] as const))("platform '%s' has non-empty name, icon, color, and EN/DE description", (_id, p) => {
    expect(p.name.trim().length).toBeGreaterThan(0);
    expect(p.icon.trim().length).toBeGreaterThan(0);
    expect(p.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(p.description.en.trim().length).toBeGreaterThan(0);
    expect(p.description.de.trim().length).toBeGreaterThan(0);
  });

  it.each(CATEGORY_ORDER)("category label '%s' is non-empty in both languages", (cat) => {
    expect(CATEGORY_LABEL[cat].en.trim().length).toBeGreaterThan(0);
    expect(CATEGORY_LABEL[cat].de.trim().length).toBeGreaterThan(0);
  });

  it("platformsByCategory groups every platform exactly once, in CATEGORY_ORDER order, skipping empty categories", () => {
    const groups = platformsByCategory();
    const flattened = groups.flatMap((g) => g.platforms.map((p) => p.id));
    expect(new Set(flattened).size).toBe(flattened.length);
    expect(flattened.sort()).toEqual(PLATFORM_CATALOG.map((p) => p.id).sort());

    const seenOrder = groups.map((g) => g.category);
    const expectedOrder = CATEGORY_ORDER.filter((c) => PLATFORM_CATALOG.some((p) => p.category === c));
    expect(seenOrder).toEqual(expectedOrder);

    for (const g of groups) expect(g.platforms.length).toBeGreaterThan(0);
  });
});
