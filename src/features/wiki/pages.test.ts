import { describe, expect, test } from "vitest";
import type { WikiPage } from "@/lib/bindings";
import { featuredPages, moveFeatured } from "./pages";
import {
  contrast,
  luminance,
  MIN_TEXT_CONTRAST,
  PRESET_KEYS,
  resolveTheme,
  themeScheme,
  themeStyle,
  WIKI_PRESETS,
} from "./theme";

function page(id: string, aliases: string[] = []): WikiPage {
  return { id, kind: "card", title: id, typeId: null, imageAssetId: null, aliases };
}

const PAGES = [page("Aragorn", ["Grands-Pas"]), page("Arwen"), page("Éowyn"), page("Minas Tirith")];

describe("featured pages", () => {
  test("skip the ids that are no longer pages, in their order", () => {
    expect(featuredPages(["Arwen", "Gone", "Aragorn"], PAGES).map((p) => p.id)).toEqual([
      "Arwen",
      "Aragorn",
    ]);
  });

  test("move to the place of another, hidden ids kept", () => {
    expect(moveFeatured(["A", "Hidden", "B", "C"], "C", "A")).toEqual(["C", "A", "Hidden", "B"]);
    expect(moveFeatured(["A", "B", "C"], "A", "C")).toEqual(["B", "C", "A"]);
    expect(moveFeatured(["A", "B"], "A", "Gone")).toEqual(["A", "B"]);
  });
});

describe("theme", () => {
  test("an unknown preset or font falls back to the default", () => {
    const theme = resolveTheme({ preset: "nope", headingFont: "comic", bodyFont: "inter" });
    expect(theme.palette).toEqual(WIKI_PRESETS.parchment.palette);
    expect(theme.headingFont).toBe("playfair");
    expect(theme.bodyFont).toBe("inter");
  });

  test("a changed palette wins over the preset's", () => {
    const palette = { ...WIKI_PRESETS.parchment.palette, accent: "#aa0000" };
    expect(themeStyle({ preset: "parchment", palette })).toMatchObject({
      "--wiki-accent": "#aa0000",
    });
  });

  test("the scheme follows the background", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1);
    expect(luminance("#000000")).toBe(0);
    expect(themeScheme({ preset: "parchment" })).toBe("light");
    const palette = { ...WIKI_PRESETS.parchment.palette, background: "#14161f" };
    expect(themeScheme({ preset: "parchment", palette })).toBe("dark");
  });

  test("every provided theme is readable (WCAG AA)", () => {
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21);
    for (const key of PRESET_KEYS) {
      const { palette } = WIKI_PRESETS[key];
      for (const color of [palette.text, palette.muted]) {
        expect(contrast(color, palette.background), `${key} ${color}`).toBeGreaterThanOrEqual(
          MIN_TEXT_CONTRAST,
        );
        expect(contrast(color, palette.surface), `${key} ${color}`).toBeGreaterThanOrEqual(
          MIN_TEXT_CONTRAST,
        );
      }
      // The accent writes the titles and the links: as readable as the text.
      expect(contrast(palette.accent, palette.background), key).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      );
    }
  });
});
