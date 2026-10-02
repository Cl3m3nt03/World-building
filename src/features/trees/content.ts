import type { TreeEdge, TreeNode, VariantContent } from "@/lib/bindings";
import type { Direction } from "./relations";

/** Size of a node, in tree units (PersonNode draws it). */
export const NODE_WIDTH = 96;
export const NODE_HEIGHT = 120;
/** Space left between a node and a relative added next to it. */
const RELATIVE_GAP = { x: 72, y: 96 };

/** What a node stands for: a card, a plain name, or nothing yet. */
export type NodeFill = { cardId: string } | { label: string };

/** A new empty node at (`x`, `y`). */
export function newNode(x: number, y: number): TreeNode {
  return { id: crypto.randomUUID(), cardId: null, label: "", x, y };
}

export function addNode(content: VariantContent, node: TreeNode): VariantContent {
  return { ...content, nodes: [...content.nodes, node] };
}

/** Gives a node its card or its plain name (the other is cleared). */
export function fillNode(content: VariantContent, id: string, fill: NodeFill): VariantContent {
  return {
    ...content,
    nodes: content.nodes.map((node) =>
      node.id !== id
        ? node
        : "cardId" in fill
          ? { ...node, cardId: fill.cardId, label: "" }
          : { ...node, cardId: null, label: fill.label.trim() },
    ),
  };
}

/** Moves nodes to new places (tree coordinates). */
export function moveNodes(
  content: VariantContent,
  positions: ReadonlyMap<string, { x: number; y: number }>,
): VariantContent {
  return {
    ...content,
    nodes: content.nodes.map((node) => {
      const moved = positions.get(node.id);
      return moved ? { ...node, x: moved.x, y: moved.y } : node;
    }),
  };
}

/**
 * Removes a node with its links, and the links hanging from those (a
 * junction from a removed link goes with it), however deep.
 */
export function removeNode(content: VariantContent, id: string): VariantContent {
  const removed = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const edge of content.edges) {
      if (removed.has(edge.id)) continue;
      const fromGone =
        edge.source.kind === "node" ? edge.source.id === id : removed.has(edge.source.id);
      if (fromGone || edge.target === id) {
        removed.add(edge.id);
        grew = true;
      }
    }
  }
  return {
    ...content,
    nodes: content.nodes.filter((node) => node.id !== id),
    edges: content.edges.filter((edge) => !removed.has(edge.id)),
  };
}

/** Whether a node at (`x`, `y`) would cover one of `content`'s nodes. */
function covers(content: VariantContent, x: number, y: number): boolean {
  return content.nodes.some(
    (node) =>
      Math.abs((node.x ?? 0) - x) < NODE_WIDTH + 16 &&
      Math.abs((node.y ?? 0) - y) < NODE_HEIGHT + 16,
  );
}

/**
 * Adds an empty node on the `direction` side of node `fromId`, linked from
 * it by `relationTypeId` (`null`: a link without a type yet). It is moved
 * along that side while it would cover another node. Returns the content
 * and the new node's id (`null` if `fromId` is not in the content).
 */
export function addRelative(
  content: VariantContent,
  fromId: string,
  direction: Direction,
  relationTypeId: string | null,
): { content: VariantContent; nodeId: string | null } {
  const from = content.nodes.find((node) => node.id === fromId);
  if (!from) return { content, nodeId: null };
  const step = {
    top: [0, -(NODE_HEIGHT + RELATIVE_GAP.y)],
    bottom: [0, NODE_HEIGHT + RELATIVE_GAP.y],
    left: [-(NODE_WIDTH + RELATIVE_GAP.x), 0],
    right: [NODE_WIDTH + RELATIVE_GAP.x, 0],
  }[direction];
  // Taken: slide sideways (along a row for parents and children, down a
  // column for the rest), alternately on each side.
  const slide =
    direction === "top" || direction === "bottom"
      ? [NODE_WIDTH + RELATIVE_GAP.x / 2, 0]
      : [0, NODE_HEIGHT + RELATIVE_GAP.y / 2];
  const x0 = (from.x ?? 0) + (step[0] ?? 0);
  const y0 = (from.y ?? 0) + (step[1] ?? 0);
  let x = x0;
  let y = y0;
  for (let i = 1; i < 200 && covers(content, x, y); i++) {
    const offset = Math.ceil(i / 2) * (i % 2 === 1 ? 1 : -1);
    x = x0 + offset * (slide[0] ?? 0);
    y = y0 + offset * (slide[1] ?? 0);
  }
  const node = newNode(Math.round(x), Math.round(y));
  const edge: TreeEdge = {
    id: crypto.randomUUID(),
    source: { kind: "node", id: fromId },
    target: node.id,
    relationTypeId,
    lineStyle: "solid",
  };
  return {
    content: { ...content, nodes: [...content.nodes, node], edges: [...content.edges, edge] },
    nodeId: node.id,
  };
}

/** Links removed with link `id`: it and the junctions hanging from it, however deep. */
function withJunctions(content: VariantContent, id: string): Set<string> {
  const removed = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const edge of content.edges) {
      if (!removed.has(edge.id) && edge.source.kind === "edge" && removed.has(edge.source.id)) {
        removed.add(edge.id);
        grew = true;
      }
    }
  }
  return removed;
}

/** Removes a link and the junctions hanging from it. */
export function removeEdge(content: VariantContent, id: string): VariantContent {
  const removed = withJunctions(content, id);
  return { ...content, edges: content.edges.filter((edge) => !removed.has(edge.id)) };
}

/** Changes a link's relation type or line style. */
export function updateEdge(
  content: VariantContent,
  id: string,
  patch: Partial<Pick<TreeEdge, "relationTypeId" | "lineStyle">>,
): VariantContent {
  return {
    ...content,
    edges: content.edges.map((edge) => (edge.id === id ? { ...edge, ...patch } : edge)),
  };
}

/**
 * Links node `sourceId` to node `targetId` (no type yet). Nothing changes
 * for a node to itself or a link that already joins them that way. Returns
 * the content and the new link's id.
 */
export function connect(
  content: VariantContent,
  sourceId: string,
  targetId: string,
): { content: VariantContent; edgeId: string | null } {
  const known = new Set(content.nodes.map((node) => node.id));
  const exists = content.edges.some(
    (edge) =>
      edge.source.kind === "node" && edge.source.id === sourceId && edge.target === targetId,
  );
  if (sourceId === targetId || !known.has(sourceId) || !known.has(targetId) || exists) {
    return { content, edgeId: null };
  }
  const edge: TreeEdge = {
    id: crypto.randomUUID(),
    source: { kind: "node", id: sourceId },
    target: targetId,
    relationTypeId: null,
    lineStyle: "solid",
  };
  return { content: { ...content, edges: [...content.edges, edge] }, edgeId: edge.id };
}

/**
 * Moves one end of a link to node `nodeId`; the other end stays. A link
 * from a link (a junction) keeps its start. Nothing changes for a loop.
 */
export function reconnectEdge(
  content: VariantContent,
  id: string,
  end: "source" | "target",
  nodeId: string,
): VariantContent {
  return {
    ...content,
    edges: content.edges.map((edge) => {
      if (edge.id !== id) return edge;
      if (end === "target") {
        const loop = edge.source.kind === "node" && edge.source.id === nodeId;
        return loop ? edge : { ...edge, target: nodeId };
      }
      if (edge.source.kind !== "node" || edge.target === nodeId) return edge;
      return { ...edge, source: { kind: "node", id: nodeId } };
    }),
  };
}

/** Turns a link round (its relation then reads the other way). Not a junction. */
export function reverseEdge(content: VariantContent, id: string): VariantContent {
  return {
    ...content,
    edges: content.edges.map((edge) =>
      edge.id === id && edge.source.kind === "node"
        ? { ...edge, source: { kind: "node", id: edge.target }, target: edge.source.id }
        : edge,
    ),
  };
}
