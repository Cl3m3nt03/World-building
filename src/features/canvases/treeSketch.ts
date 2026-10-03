import type { VariantContent } from "@/lib/bindings";

/** Size of a node in a tree's sketch (the tree's own units). */
export const SKETCH_NODE = { width: 96, height: 120 } as const;

type Line = { x1: number; y1: number; x2: number; y2: number };

export type Sketch = {
  nodes: { id: string; x: number; y: number }[];
  lines: Line[];
  /** `minX minY width height`, with a margin. */
  viewBox: string;
};

/**
 * A tree drawn small, for its thumbnail on a canvas: its nodes where they
 * are (a node never placed goes in a row under the others) and its links
 * between their centres (a link from a link starts at that link's middle).
 */
export function treeSketch(content: VariantContent): Sketch {
  const placed = content.nodes.filter((node) => node.x !== null && node.y !== null);
  const bottom = placed.reduce((max, node) => Math.max(max, node.y ?? 0), 0);
  let next = 0;
  const nodes = content.nodes.map((node) =>
    node.x !== null && node.y !== null
      ? { id: node.id, x: node.x, y: node.y }
      : { id: node.id, x: next++ * (SKETCH_NODE.width + 24), y: bottom + SKETCH_NODE.height * 2 },
  );
  const centre = new Map(
    nodes.map((node) => [
      node.id,
      { x: node.x + SKETCH_NODE.width / 2, y: node.y + SKETCH_NODE.height / 2 },
    ]),
  );
  const ends = new Map<string, Line>();
  const endsOf = (edgeId: string, depth: number): Line | null => {
    const known = ends.get(edgeId);
    if (known) return known;
    const edge = content.edges.find((each) => each.id === edgeId);
    if (!edge || depth > 8) return null;
    const to = centre.get(edge.target);
    let from: { x: number; y: number } | undefined;
    if (edge.source.kind === "node") from = centre.get(edge.source.id);
    else {
      const parent = endsOf(edge.source.id, depth + 1);
      if (parent) from = { x: (parent.x1 + parent.x2) / 2, y: (parent.y1 + parent.y2) / 2 };
    }
    if (!from || !to) return null;
    const line = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
    ends.set(edgeId, line);
    return line;
  };
  const lines = content.edges.flatMap((edge) => {
    const line = endsOf(edge.id, 0);
    return line ? [line] : [];
  });

  const margin = 40;
  const xs = nodes.flatMap((node) => [node.x, node.x + SKETCH_NODE.width]);
  const ys = nodes.flatMap((node) => [node.y, node.y + SKETCH_NODE.height]);
  const minX = Math.min(0, ...xs) - margin;
  const minY = Math.min(0, ...ys) - margin;
  const maxX = Math.max(SKETCH_NODE.width, ...xs) + margin;
  const maxY = Math.max(SKETCH_NODE.height, ...ys) + margin;
  return { nodes, lines, viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}` };
}
