import { describe, expect, test } from "vitest";
import type { WikiPage } from "@/lib/bindings";
import { featuredPages, moveFeatured } from "./pages";
import { luminance, resolveTheme, themeScheme, themeStyle, WIKI_PRESETS } from "./theme";

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
    const theme = resolveTheme({ preset: "nope", headingFont: "comic", bodyFont: "serif" });
    expect(theme.palette).toEqual(WIKI_PRESETS.parchment.palette);
    expect(theme.headingFont).toBe("serif");
    expect(theme.bodyFont).toBe("serif");
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
});
