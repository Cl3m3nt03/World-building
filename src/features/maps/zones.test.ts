import { expect, test } from "vitest";
import type { MapContent } from "@/lib/bindings";
import {
  addZone,
  centroid,
  edgeMiddles,
  insertVertex,
  moveVertex,
  newZone,
  type Point,
  removeVertex,
  removeZone,
  updateZone,
} from "./zones";

const EMPTY: MapContent = {
  layers: [{ id: "l1", name: "Calque 1", visible: true }],
  pins: [],
  zones: [],
  texts: [],
};
const SQUARE: Point[] = [
  [0.2, 0.2],
  [0.6, 0.2],
  [0.6, 0.6],
  [0.2, 0.6],
];

test("a zone of ten vertices is drawn, linked to a card and styled", () => {
  const ten: Point[] = Array.from({ length: 10 }, (_, i) => [
    0.5 + 0.3 * Math.cos((i / 10) * Math.PI * 2),
    0.5 + 0.3 * Math.sin((i / 10) * Math.PI * 2),
  ]);
  const zone = newZone("l1", ten, "Mordor");
  let content = addZone(EMPTY, zone);
  content = updateZone(content, zone.id, { cardId: "mordor", pattern: "hatch", opacity: 0.6 });
  expect(content.zones[0]).toMatchObject({ label: "Mordor", cardId: "mordor", pattern: "hatch" });
  expect(content.zones[0]?.points).toHaveLength(10);
  expect(removeZone(content, zone.id).zones).toEqual([]);
});

test("vertices move, are added on an edge and removed, never under three", () => {
  const zone = newZone("l1", SQUARE);
  let content = addZone(EMPTY, zone);
  content = moveVertex(content, zone.id, 0, [0.1, -0.5]);
  expect(content.zones[0]?.points[0]).toEqual([0.1, 0]);

  const [middle] = edgeMiddles(content.zones[0]?.points as Point[]);
  content = insertVertex(content, zone.id, 0, middle as Point);
  expect(content.zones[0]?.points).toHaveLength(5);
  expect(content.zones[0]?.points[1]).toEqual(middle);

  content = removeVertex(content, zone.id, 1);
  content = removeVertex(content, zone.id, 0);
  expect(content.zones[0]?.points).toHaveLength(3);
  expect(removeVertex(content, zone.id, 0)).toBe(content);
  const [cx, cy] = centroid(SQUARE);
  expect(cx).toBeCloseTo(0.4);
  expect(cy).toBeCloseTo(0.4);
});
