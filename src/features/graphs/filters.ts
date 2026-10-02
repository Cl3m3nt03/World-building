import type { CardType, GraphData } from "@/lib/bindings";

/**
 * What the graph shows (docs/features/04-graph.md, « Filtres » and « Masquer
 * les nœuds isolés »): the cards of the chosen types (a type includes its
 * subtypes; no type chosen: every card) and the links between them; without
 * the cards left with no link when `hideIsolated`.
 */
export function visibleGraph(
  data: GraphData,
  typeIds: readonly string[],
  types: readonly CardType[],
  hideIsolated: boolean,
): GraphData {
  let nodes = data.nodes;
  if (typeIds.length > 0) {
    const wanted = new Set(typeIds);
    for (const type of types) {
      if (type.parentId && wanted.has(type.parentId)) wanted.add(type.id);
    }
    nodes = nodes.filter((node) => node.typeId !== null && wanted.has(node.typeId));
  }
  const shown = new Set(nodes.map((node) => node.id));
  const edges = data.edges.filter((edge) => shown.has(edge.source) && shown.has(edge.target));
  if (hideIsolated) {
    const linked = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
    nodes = nodes.filter((node) => linked.has(node.id));
  }
  return nodes === data.nodes && edges.length === data.edges.length ? data : { nodes, edges };
}
