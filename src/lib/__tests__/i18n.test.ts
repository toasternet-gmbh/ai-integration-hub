import { describe, expect, it } from "vitest";
import { STRINGS, t } from "../i18n";

describe("i18n", () => {
  const keys = Object.keys(STRINGS);

  it("has at least the keys used across the app (sanity check the map isn't empty)", () => {
    expect(keys.length).toBeGreaterThan(50);
  });

  it.each(keys)("resolves every key in both languages, non-empty, not a raw fallback: %s", (key) => {
    const en = STRINGS[key].en;
    const de = STRINGS[key].de;
    expect(en.trim().length).toBeGreaterThan(0);
    expect(de.trim().length).toBeGreaterThan(0);
    expect(t(key, "en")).toBe(en);
    expect(t(key, "de")).toBe(de);
  });

  it("falls back to the raw key for an unknown key, rather than throwing", () => {
    expect(t("this.key.does.not.exist", "en")).toBe("this.key.does.not.exist");
  });
});
