import { getSmoothStepPath, Position } from "@xyflow/react";
import type { VariantContent } from "@/lib/bindings";
import { NODE_HEIGHT, NODE_WIDTH } from "./content";
import type { Direction } from "./relations";

/**
 * Where links attach and run, computed like React Flow draws them (the
 * attach points' boxes are set in globals.css and PersonNode): a junction
 * starts from the middle of its link, so that middle must be known before
 * React Flow draws anything.
 */

/** Size of a node's attach point, and how far below the node the bottom one sits (under the name's badge). */
export const HANDLE_SIZE = 9;
export const BOTTOM_HANDLE_OFFSET = 14;
/** Size of a junction point (the middle of a link). */
export const JUNCTION_SIZE = 10;

export type Point = { x: number; y: number };

const POSITIONS: Record<Direction, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

/** Where a link attaches on side `side` of a node placed at `at`. */
export function nodeAnchor(at: Point, side: Direction): Point {
  const half = HANDLE_SIZE / 2;
  switch (side) {
    case "top":
      return { x: at.x + NODE_WIDTH / 2, y: at.y - half };
    case "right":
      return { x: at.x + NODE_WIDTH + half, y: at.y + NODE_HEIGHT / 2 };
    case "bottom":
      return { x: at.x + NODE_WIDTH / 2, y: at.y + NODE_HEIGHT + BOTTOM_HANDLE_OFFSET + half };
    case "left":
      return { x: at.x - half, y: at.y + NODE_HEIGHT / 2 };
  }
}

/** Where a link attaches on side `side` of the junction point at `at` (its centre). */
export function junctionAnchor(at: Point, side: Direction): Point {
  const half = JUNCTION_SIZE / 2;
  switch (side) {
    case "top":
      return { x: at.x, y: at.y - half };
    case "right":
      return { x: at.x + half, y: at.y };
    case "bottom":
      return { x: at.x, y: at.y + half };
    case "left":
      return { x: at.x - half, y: at.y };
  }
}

/**
 * The sides two things linked attach to: the ones facing each other
 * (above / below, or side by side), from their centres.
 */
export function facingSides(from: Point, to: Point): [Direction, Direction] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dy) / NODE_HEIGHT >= Math.abs(dx) / NODE_WIDTH) {
    return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
  }
  return dx >= 0 ? ["right", "left"] : ["left", "right"];
}

export type LinkGeometry = {
  sourceSide: Direction;
  targetSide: Direction;
  /** The middle of the drawn link: where its junctions start. */
  middle: Point;
};

/**
 * How each link of `content` runs, given where its nodes are (`positions`,
 * top-left corners): its sides and its middle. A junction starts from its
 * link's middle, so links come in order (a junction after the link it
 * hangs from). Links whose ends are unknown are left out.
 */
export function linkGeometry(
  content: VariantContent,
  positions: ReadonlyMap<string, Point>,
): Map<string, LinkGeometry> {
  const result = new Map<string, LinkGeometry>();
  const centre = (at: Point) => ({ x: at.x + NODE_WIDTH / 2, y: at.y + NODE_HEIGHT / 2 });
  for (const edge of content.edges) {
    const to = positions.get(edge.target);
    if (!to) continue;
    let fromCentre: Point;
    let anchor: (side: Direction) => Point;
    if (edge.source.kind === "node") {
      const from = positions.get(edge.source.id);
      if (!from) continue;
      fromCentre = centre(from);
      anchor = (side) => nodeAnchor(from, side);
    } else {
      const parent = result.get(edge.source.id);
      if (!parent) continue;
      const point = parent.middle;
      fromCentre = point;
      anchor = (side) => junctionAnchor(point, side);
    }
    const [sourceSide, targetSide] = facingSides(fromCentre, centre(to));
    const source = anchor(sourceSide);
    const target = nodeAnchor(to, targetSide);
    const [, x, y] = getSmoothStepPath({
      sourceX: source.x,
      sourceY: source.y,
      sourcePosition: POSITIONS[sourceSide],
      targetX: target.x,
      targetY: target.y,
      targetPosition: POSITIONS[targetSide],
      borderRadius: 6,
    });
    result.set(edge.id, { sourceSide, targetSide, middle: { x, y } });
  }
  return result;
}
