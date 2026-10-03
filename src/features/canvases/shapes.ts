/**
 * The cloud and the bubble (M7 step 7.7, docs/features/06-canvas.md):
 * shapes Excalidraw does not have, drawn as closed lines (a line whose last
 * point is its first is filled like a shape). Their points fill a `width` ×
 * `height` box from (0, 0). Pure functions, tested in shapes.test.ts.
 */

export type Point = [number, number];

/** A box drawn with the pointer, in any direction, as top left and size. */
export function boxOf(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}

/** Scales points so that they fill the box exactly, and closes the path. */
function fitBox(points: Point[], width: number, height: number): Point[] {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  const fitted = points.map(
    ([x, y]): Point => [((x - minX) / spanX) * width, ((y - minY) / spanY) * height],
  );
  const first = fitted[0];
  return first ? [...fitted, [first[0], first[1]]] : fitted;
}

/** Bumps around a cloud. */
const LOBES = 9;
const CLOUD_STEPS = 108;

/** A cloud: an oval scalloped all around. */
export function cloudPoints(width: number, height: number): Point[] {
  const points: Point[] = [];
  for (let step = 0; step < CLOUD_STEPS; step++) {
    const angle = (step / CLOUD_STEPS) * Math.PI * 2;
    const bump = 1 + 0.16 * Math.abs(Math.sin((LOBES * angle) / 2));
    points.push([Math.cos(angle) * bump, Math.sin(angle) * bump]);
  }
  return fitBox(points, width, height);
}

/** Points of a quarter circle from `start` angle, around (`cx`, `cy`). */
function corner(cx: number, cy: number, radius: number, start: number): Point[] {
  const points: Point[] = [];
  for (let step = 0; step <= 6; step++) {
    const angle = start + (step / 6) * (Math.PI / 2);
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return points;
}

/** A speech bubble: a rounded box, its tail down on the left. */
export function bubblePoints(width: number, height: number): Point[] {
  const body = height * 0.78;
  const radius = Math.min(width, body) * 0.2;
  const tailFrom = width * 0.36;
  const tailTo = width * 0.2;
  const points: Point[] = [
    ...corner(width - radius, radius, radius, -Math.PI / 2),
    ...corner(width - radius, body - radius, radius, 0),
    [tailFrom, body],
    [width * 0.12, height],
    [tailTo, body],
    ...corner(radius, body - radius, radius, Math.PI / 2),
    ...corner(radius, radius, radius, Math.PI),
  ];
  return fitBox(points, width, height);
}

/** Size of a cloud or bubble placed with a click (no drag). */
export const DEFAULT_SHAPE_SIZE = { width: 220, height: 140 } as const;
/** Below this, a drag is a click. */
export const MIN_SHAPE_SIZE = 8;
