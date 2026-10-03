import { describe, expect, it } from "vitest";
import { boxOf, bubblePoints, cloudPoints, type Point } from "./shapes";

const bounds = (points: Point[]) => ({
  minX: Math.min(...points.map(([x]) => x)),
  maxX: Math.max(...points.map(([x]) => x)),
  minY: Math.min(...points.map(([, y]) => y)),
  maxY: Math.max(...points.map(([, y]) => y)),
});

describe.each([
  ["cloud", cloudPoints],
  ["bubble", bubblePoints],
])("%s", (_, shape) => {
  it("fills its box exactly", () => {
    const b = bounds(shape(300, 180));
    expect(b.minX).toBeCloseTo(0);
    expect(b.minY).toBeCloseTo(0);
    expect(b.maxX).toBeCloseTo(300);
    expect(b.maxY).toBeCloseTo(180);
  });

  it("is closed: Excalidraw fills it like a shape", () => {
    const points = shape(120, 80);
    expect(points.at(-1)).toEqual(points[0]);
    expect(points.length).toBeGreaterThan(10);
  });
});

it("gives the bubble its tail at the bottom left", () => {
  const points = bubblePoints(200, 100);
  const tip = points.reduce((low, point) => (point[1] > low[1] ? point : low));
  expect(tip[1]).toBeCloseTo(100);
  expect(tip[0]).toBeLessThan(60);
});

it("takes a box drawn in any direction", () => {
  expect(boxOf({ x: 50, y: 40 }, { x: 10, y: 100 })).toEqual({
    x: 10,
    y: 40,
    width: 40,
    height: 60,
  });
});
