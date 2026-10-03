import { expect, test } from "vitest";
import type { VariantContent } from "@/lib/bindings";
import {
  addAnnotation,
  annotationColor,
  extendStroke,
  moveAnnotation,
  newDrawing,
  newText,
  removeAnnotation,
  strokePath,
  updateDrawing,
  updateText,
} from "./annotations";

const EMPTY: VariantContent = { nodes: [], edges: [], annotations: [] };

test("a stroke keeps points far enough apart; a single point is a dot", () => {
  let points: [number, number][] = [];
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [3, 0],
    [3, 4],
  ] as const) {
    points = extendStroke(points, x, y);
  }
  expect(points).toEqual([
    [0, 0],
    [3, 0],
    [3, 4],
  ]);
  expect(strokePath(points)).toBe("M0 0 L3 0 L3 4");
  expect(newDrawing([[5, 5]], "ink", 4).points).toEqual([
    [5, 5],
    [5, 5],
  ]);
});

test("annotations are added, moved, changed and removed; an emptied text goes", () => {
  const stroke = newDrawing(
    [
      [0, 0],
      [10, 10],
    ],
    "red",
    4,
  );
  const text = newText(20, 30, "ink", 20);
  let content = addAnnotation(addAnnotation(EMPTY, stroke), text);
  content = moveAnnotation(content, stroke.id, 5, -5);
  content = moveAnnotation(content, text.id, 1, 2);
  expect(content.annotations[0]).toMatchObject({
    points: [
      [5, -5],
      [15, 5],
    ],
  });
  expect(content.annotations[1]).toMatchObject({ x: 21, y: 32 });

  content = updateText(content, text.id, { text: "  Le Gondor  ", size: 32 });
  expect(content.annotations[1]).toMatchObject({ text: "Le Gondor", size: 32 });
  content = updateDrawing(content, stroke.id, { color: "blue", width: 8 });
  expect(content.annotations[0]).toMatchObject({ color: "blue", width: 8 });

  expect(updateText(content, text.id, { text: "   " }).annotations).toHaveLength(1);
  expect(removeAnnotation(content, stroke.id).annotations).toEqual([content.annotations[1]]);
});

test("annotation colours follow the theme's tokens", () => {
  expect(annotationColor("ink")).toBe("var(--foreground)");
  expect(annotationColor("red")).toBe("var(--bz-type-red)");
  expect(annotationColor("anything")).toBe("var(--bz-type-slate)");
});
