import { expect, it } from "vitest";
import type { VariantContent } from "@/lib/bindings";
import { SKETCH_NODE, treeSketch } from "./treeSketch";

const node = (id: string, x: number | null, y: number | null) => ({
  id,
  cardId: null,
  label: id,
  x,
  y,
});

it("draws the nodes where they are and the links between their centres", () => {
  const content: VariantContent = {
    nodes: [node("a", 0, 0), node("b", 200, 0), node("c", 100, 300)],
    edges: [
      {
        id: "ab",
        source: { kind: "node", id: "a" },
        target: "b",
        relationTypeId: null,
        lineStyle: "solid",
      },
      // A child of the couple: from the middle of their link.
      {
        id: "abc",
        source: { kind: "edge", id: "ab" },
        target: "c",
        relationTypeId: null,
        lineStyle: "solid",
      },
    ],
    annotations: [],
  } as unknown as VariantContent;
  const sketch = treeSketch(content);
  expect(sketch.nodes).toHaveLength(3);
  const cx = (x: number) => x + SKETCH_NODE.width / 2;
  const cy = (y: number) => y + SKETCH_NODE.height / 2;
  expect(sketch.lines[0]).toEqual({ x1: cx(0), y1: cy(0), x2: cx(200), y2: cy(0) });
  expect(sketch.lines[1]).toEqual({
    x1: (cx(0) + cx(200)) / 2,
    y1: cy(0),
    x2: cx(100),
    y2: cy(300),
  });
});

it("puts the nodes never placed in a row under the others", () => {
  const sketch = treeSketch({
    nodes: [node("a", 0, 100), node("b", null, null), node("c", null, null)],
    edges: [],
    annotations: [],
  } as unknown as VariantContent);
  const [, b, c] = sketch.nodes;
  expect(b?.y).toBe(c?.y);
  expect(b && b.y > 100).toBe(true);
  expect(c && b && c.x > b.x).toBe(true);
});

it("frames an empty tree", () => {
  expect(treeSketch({ nodes: [], edges: [], annotations: [] }).viewBox).toMatch(/^-?\d/);
});
