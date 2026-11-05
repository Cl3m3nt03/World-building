import { describe, expect, test } from "vitest";
import { MATERIALS } from "@/features/world-theme/materials";
import type { WikiPage, WorldTheme } from "@/lib/bindings";
import { featuredPages, moveFeatured } from "./pages";
import {
  atlasPreset,
  contrast,
  luminance,
  MIN_TEXT_CONTRAST,
  PRESET_KEYS,
  presetOf,
  resolveTheme,
  SITE_FONTS,
  themeScheme,
  themeStyle,
  WIKI_PRESETS,
  type WikiLook,
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
  test("an unknown preset or font falls back to the default, Atlas", () => {
    const theme = resolveTheme({ preset: "nope", headingFont: "comic", bodyFont: "inter" });
    expect(theme.palette).toEqual(atlasPreset({ world: null, mode: "light" }).palette);
    expect(theme.headingFont).toBe("alegreya");
    expect(theme.bodyFont).toBe("inter");
  });

  test("a chosen preset is kept as it is, whatever the world and the mode", () => {
    const dark: WikiLook = { world: { kind: "preset", id: "night" }, mode: "dark" };
    expect(resolveTheme({ preset: "parchment" }, dark)).toEqual(WIKI_PRESETS.parchment);
    expect(themeScheme({ preset: "parchment" }, dark)).toBe("light");
  });

  test("Atlas follows the mode shown, the material, the accent and the heading font", () => {
    expect(themeScheme({ preset: "atlas" }, { world: null, mode: "dark" })).toBe("dark");
    expect(themeScheme({ preset: "atlas" }, { world: null, mode: "light" })).toBe("light");
    const world: WorldTheme = {
      kind: "custom",
      background: null,
      accent: "#4fd6f0",
      material: "coldGlass",
      headingFont: "ebGaramond",
    };
    const shown = resolveTheme({ preset: "atlas" }, { world, mode: "dark" });
    expect(shown.palette.background).toBe("#060b11");
    expect(shown.palette.accent).toBe("#4fd6f0");
    expect(shown.headingFont).toBe("garamond");
    expect(shown.bodyFont).toBe("alegreya-sans");
    expect(themeStyle({ preset: "atlas" }, { world, mode: "dark" })).toMatchObject({
      "--wiki-heading-font": SITE_FONTS.garamond,
    });
    // Its colours or fonts changed by hand stay as chosen.
    const palette = { ...WIKI_PRESETS.ink.palette };
    expect(resolveTheme({ preset: "atlas", palette }, { world, mode: "dark" }).palette).toEqual(
      palette,
    );
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
      const { palette } = presetOf(key);
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

describe("Atlas theme", () => {
  // Each material, in each mode, with its own accent and with accents far
  // from it: text, muted text and accent (titles, links) at 4.5:1 at least.
  const accents = ["#4fd6f0", "#ffe14d", "#1a1206", "#c0392b", "#7d5e1e", "#d9b25c", "#ffffff"];
  for (const material of MATERIALS) {
    for (const mode of ["light", "dark"] as const) {
      test(`is readable on ${material} in ${mode} (WCAG AA)`, () => {
        for (const accent of accents) {
          const world: WorldTheme = { kind: "custom", background: null, accent, material };
          const { palette } = atlasPreset({ world, mode });
          for (const color of [palette.text, palette.muted, palette.accent]) {
            for (const ground of [palette.background, palette.surface]) {
              expect(
                contrast(color, ground),
                `${material} ${mode} ${accent} ${color}`,
              ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
            }
          }
          expect(themeScheme({ preset: "atlas" }, { world, mode })).toBe(mode);
        }
      });
    }
  }

  test("without a world, is Vellum with the default ochre", () => {
    const { palette } = atlasPreset({ world: null, mode: "light" });
    expect(palette.background).toBe("#f2e9d4");
    expect(contrast(palette.accent, palette.background)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
});
