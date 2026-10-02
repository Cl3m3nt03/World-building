import type { TreeNode, VariantContent } from "@/lib/bindings";

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
