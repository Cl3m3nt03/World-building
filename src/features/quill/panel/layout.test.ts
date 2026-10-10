import { describe, expect, test } from "vitest";
import { type HomeBlock, MIN_BLOCK, moved, newBlockPlace, readLayout, resized } from "./layout";

describe("readLayout", () => {
  test("defaults for nothing or garbage", () => {
    expect(readLayout("{}")).toEqual({ dock: null, blocks: [], style: "world" });
    expect(readLayout("nope")).toEqual({ dock: null, blocks: [], style: "world" });
    expect(readLayout("[1]").style).toBe("world");
  });

  test("keeps good blocks, mends odd ones, drops broken ones", () => {
    const layout = readLayout(
      JSON.stringify({
        dock: { grid: {} },
        style: "dark",
        blocks: [
          { id: "a", kind: "card", cardId: "c1", x: 10, y: 20, w: 300, h: 200 },
          { id: "b", kind: "card", x: 0, y: 0 },
          { id: "c", kind: "notes", x: -5, y: "x", w: 10 },
          { id: "d", kind: "moodboard", assetIds: ["i1", 3, "i2"] },
          { id: "e", kind: "nope" },
        ],
      }),
    );
    expect(layout.style).toBe("dark");
    expect(layout.dock).toEqual({ grid: {} });
    expect(layout.blocks.map((item) => item.id)).toEqual(["a", "c", "d"]);
    expect(layout.blocks[1]).toMatchObject({ x: 0, y: 0, w: MIN_BLOCK.w, h: 240 });
    expect(layout.blocks[2]?.assetIds).toEqual(["i1", "i2"]);
  });
});

describe("blocks", () => {
  const item: HomeBlock = { id: "a", kind: "notes", x: 10, y: 10, w: 200, h: 150 };

  test("move and resize within limits", () => {
    expect(moved(item, -50, 30)).toMatchObject({ x: 0, y: 40 });
    expect(resized(item, -100, 20)).toMatchObject({ w: MIN_BLOCK.w, h: 170 });
  });

  test("a new block goes under the others", () => {
    expect(newBlockPlace([])).toEqual({ x: 0, y: 0 });
    expect(newBlockPlace([item, { ...item, id: "b", y: 200, h: 100 }])).toEqual({ x: 0, y: 312 });
  });
});
