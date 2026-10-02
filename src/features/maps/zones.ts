import type { MapContent, MapZone, ZonePattern } from "@/lib/bindings";
import { clamp01 } from "./pins";

/**
 * Zones of a map (M4 step 4.6, docs/features/03-map.md): polygons of 3
 * vertices at least, positions relative to the image. Pure functions,
 * tested in zones.test.ts.
 */

export type Point = [number, number];

export const ZONE_PATTERNS: ZonePattern[] = ["solid", "hatch", "dots", "cross"];
export const ZONE_FONTS = ["serif", "sans-serif", "monospace", "cursive"] as const;
export const MIN_VERTICES = 3;

export function newZone(layerId: string, points: Point[], label = ""): MapZone {
  return {
    id: crypto.randomUUID(),
    layerId,
    points: points.map(([x, y]) => [clamp01(x), clamp01(y)]),
    label,
    labelStyle: { font: "serif", size: 18 },
    cardId: null,
    fillColor: "blue",
    opacity: 0.35,
    pattern: "solid",
  };
}

export function addZone(content: MapContent, zone: MapZone): MapContent {
  return { ...content, zones: [...content.zones, zone] };
}

export function updateZone(content: MapContent, id: string, patch: Partial<MapZone>): MapContent {
  return {
    ...content,
    zones: content.zones.map((zone) => (zone.id === id ? { ...zone, ...patch } : zone)),
  };
}

export function removeZone(content: MapContent, id: string): MapContent {
  return { ...content, zones: content.zones.filter((zone) => zone.id !== id) };
}

function withPoints(content: MapContent, id: string, change: (points: Point[]) => Point[]) {
  const zone = content.zones.find((other) => other.id === id);
  if (!zone) return content;
  const points = change(zone.points as Point[]);
  return points === zone.points ? content : updateZone(content, id, { points });
}

export function moveVertex(
  content: MapContent,
  id: string,
  index: number,
  point: Point,
): MapContent {
  return withPoints(content, id, (points) =>
    index < 0 || index >= points.length
      ? points
      : points.map((other, at) => (at === index ? [clamp01(point[0]), clamp01(point[1])] : other)),
  );
}

/** A new vertex after `index` (on the edge from `index` to the next vertex). */
export function insertVertex(
  content: MapContent,
  id: string,
  index: number,
  point: Point,
): MapContent {
  return withPoints(content, id, (points) =>
    index < 0 || index >= points.length
      ? points
      : [
          ...points.slice(0, index + 1),
          [clamp01(point[0]), clamp01(point[1])],
          ...points.slice(index + 1),
        ],
  );
}

/** Without the vertex `index`; a zone keeps {@link MIN_VERTICES} vertices. */
export function removeVertex(content: MapContent, id: string, index: number): MapContent {
  return withPoints(content, id, (points) =>
    points.length <= MIN_VERTICES || index < 0 || index >= points.length
      ? points
      : points.filter((_, at) => at !== index),
  );
}

/** Middle of each edge, where a click adds a vertex. */
export function edgeMiddles(points: Point[]): Point[] {
  return points.map(([x, y], index) => {
    const [nx, ny] = points[(index + 1) % points.length] ?? [x, y];
    return [(x + nx) / 2, (y + ny) / 2];
  });
}

/** Centre of the zone's vertices, where its label goes. */
export function centroid(points: Point[]): Point {
  if (points.length === 0) return [0.5, 0.5];
  const sum = points.reduce<Point>(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}
