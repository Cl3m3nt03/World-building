import { describe, expect, it } from "vitest";
import { embedAt, embedLink, embedOf, embedSize, placeAt } from "./embeds";

const placed = (id: string, x: number, y: number, patch = {}) => ({
  type: "embeddable",
  link: embedLink({ kind: "card", id }),
  x,
  y,
  width: 200,
  height: 160,
  ...patch,
});

describe("embed links", () => {
  it("round-trips each kind of document", () => {
    for (const kind of ["card", "map", "graph", "tree"] as const) {
      expect(embedOf(embedLink({ kind, id: "abc-123" }))).toEqual({ kind, id: "abc-123" });
    }
  });

  it("keeps the links of 7.4 (cards)", () => {
    expect(embedOf("https://builderz.invalid/card/abc")).toEqual({ kind: "card", id: "abc" });
  });

  it("ignores any other link", () => {
    expect(embedOf("https://www.youtube.com/watch?v=x")).toBeNull();
    expect(embedOf("https://builderz.invalid/card/")).toBeNull();
    expect(embedOf("https://builderz.invalid/card/a/b")).toBeNull();
    expect(embedOf("https://builderz.invalid/canvas/a")).toBeNull();
    expect(embedOf(null)).toBeNull();
  });
});

describe("embedAt", () => {
  it("finds the topmost document under the point", () => {
    const elements = [placed("below", 0, 0), placed("above", 100, 100)];
    expect(embedAt(elements, 150, 150)?.id).toBe("above");
    expect(embedAt(elements, 50, 50)?.id).toBe("below");
    expect(embedAt(elements, 500, 500)).toBeNull();
  });

  it("skips removed documents and other elements", () => {
    const elements = [
      placed("kept", 0, 0),
      placed("gone", 0, 0, { isDeleted: true }),
      { type: "rectangle", x: 0, y: 0, width: 300, height: 300 },
    ];
    expect(embedAt(elements, 10, 10)?.id).toBe("kept");
  });

  it("hits a rotated document in its own frame", () => {
    // A quarter turn: 200 × 160 becomes 160 wide × 200 tall around its centre (100, 80).
    const turned = [placed("turned", 0, 0, { angle: Math.PI / 2 })];
    expect(embedAt(turned, 100, 170)?.id).toBe("turned");
    expect(embedAt(turned, 5, 80)).toBeNull();
  });
});

it("centres a placed document on the point", () => {
  const { width, height } = embedSize("map");
  expect(placeAt("map", 500, 300)).toEqual({ x: 500 - width / 2, y: 300 - height / 2 });
});
