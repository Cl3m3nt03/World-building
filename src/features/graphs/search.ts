import type { GraphNode } from "@/lib/bindings";

/** `text` without accents nor case, to compare what is typed with names. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

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
