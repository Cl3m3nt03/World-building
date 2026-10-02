import { expect, test } from "vitest";
import type { MapContent } from "@/lib/bindings";
import { addText, arcGeometry, newText, removeText, shownSize, updateText } from "./texts";

const EMPTY: MapContent = {
  layers: [{ id: "l1", name: "Calque 1", visible: true }],
  pins: [],
  zones: [],
  texts: [],
};

test("texts are placed, styled and removed", () => {
  const text = newText("l1", 0.5, 1.2, "Terre du Milieu");
  expect(text).toMatchObject({ x: 0.5, y: 1, text: "Terre du Milieu" });
  let content = addText(EMPTY, text);
  content = updateText(content, text.id, {
    style: { font: "cursive", size: 40, spacing: 0.4, arc: -0.5, scaleWithZoom: false },
  });
  expect(content.texts[0]?.style).toMatchObject({ arc: -0.5, spacing: 0.4, scaleWithZoom: false });
  expect(removeText(content, text.id).texts).toEqual([]);
});

test("a text follows the zoom or not, and bends along its arc", () => {
  const text = newText("l1", 0.5, 0.5, "Mordor");
  expect(shownSize(text, 2)).toBe(56);
  expect(shownSize({ ...text, style: { ...text.style, scaleWithZoom: false } }, 2)).toBe(28);

  const straight = arcGeometry(text, 20);
  expect(straight.path).toMatch(/^M 0 20 Q [\d.]+ 20 [\d.]+ 20$/);
  const up = arcGeometry({ ...text, style: { ...text.style, arc: 1 } }, 20);
  const down = arcGeometry({ ...text, style: { ...text.style, arc: -1 } }, 20);
  // Bent up: the control point is above the ends; bent down: below.
  const control = (path: string) => Number(path.split(" ")[5]);
  const end = (path: string) => Number(path.split(" ").at(-1));
  expect(control(up.path)).toBeLessThan(end(up.path));
  expect(control(down.path)).toBeGreaterThan(end(down.path));
  expect(up.height).toBeGreaterThan(straight.height);
});
