import { describe, expect, test } from "vitest";
import type { WikiPage } from "@/lib/bindings";
import { featuredPages, moveFeatured, searchPages } from "./pages";
import { resolveTheme, themeStyle, WIKI_PRESETS } from "./theme";

function page(id: string, aliases: string[] = []): WikiPage {
  return { id, kind: "card", title: id, typeId: null, imageAssetId: null, aliases };
}

const PAGES = [page("Aragorn", ["Grands-Pas"]), page("Arwen"), page("Éowyn"), page("Minas Tirith")];

describe("searchPages", () => {
  test("finds names then aliases, accents and case ignored", () => {
    expect(searchPages(PAGES, "  ").map((p) => p.id)).toEqual([]);
    expect(searchPages(PAGES, "ar").map((p) => p.id)).toEqual(["Aragorn", "Arwen"]);
    expect(searchPages(PAGES, "eow").map((p) => p.id)).toEqual(["Éowyn"]);
    expect(searchPages(PAGES, "grands").map((p) => p.id)).toEqual(["Aragorn"]);
  });
});

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
});
