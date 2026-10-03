import type { GraphNode } from "@/lib/bindings";
import { fold } from "@/lib/text";

export { fold };

/**
 * The cards whose name or an alias contains `query` (accents and case
 * ignored), by name. An empty query finds nothing.
 */
export function searchNodes(nodes: readonly GraphNode[], query: string): GraphNode[] {
  const wanted = fold(query.trim());
  if (wanted === "") return [];
  return nodes
    .filter((node) => [node.title, ...node.aliases].some((name) => fold(name).includes(wanted)))
    .sort((a, b) => a.title.localeCompare(b.title));
}
