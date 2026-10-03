import type { DocumentKind } from "@/lib/bindings";

/**
 * Where a document of the open world opens: its page in the World tab, by
 * kind. Kinds whose module does not exist yet open as a card (they cannot
 * be created, so this does not happen).
 */
export function documentRoute(worldId: string, kind: DocumentKind, id: string) {
  if (kind === "map") {
    return { to: "/world/$worldId/world/map/$mapId", params: { worldId, mapId: id } } as const;
  }
  if (kind === "graph") {
    return {
      to: "/world/$worldId/world/graph/$graphId",
      params: { worldId, graphId: id },
    } as const;
  }
  if (kind === "canvas") {
    return {
      to: "/world/$worldId/world/canvas/$canvasId",
      params: { worldId, canvasId: id },
    } as const;
  }
  if (kind === "tree") {
    return {
      to: "/world/$worldId/world/tree/$treeId",
      params: { worldId, treeId: id },
    } as const;
  }
  return { to: "/world/$worldId/world/card/$cardId", params: { worldId, cardId: id } } as const;
}

/** A card's page in the wiki (M8). */
export function wikiCardRoute(worldId: string, cardId: string) {
  return { to: "/world/$worldId/wiki/card/$cardId", params: { worldId, cardId } } as const;
}

/** A map's page in the wiki (M8). */
export function wikiMapRoute(worldId: string, mapId: string) {
  return { to: "/world/$worldId/wiki/map/$mapId", params: { worldId, mapId } } as const;
}
