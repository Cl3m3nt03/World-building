import type { DocumentKind } from "@/lib/bindings";

/**
 * Where a document of the open world opens: its page in the World tab, by
 * kind. Kinds whose module does not exist yet open as a card (they cannot
 * be created, so this does not happen).
 */
export function documentRoute(worldId: string, kind: DocumentKind, id: string) {
  return kind === "map"
    ? ({ to: "/world/$worldId/world/map/$mapId", params: { worldId, mapId: id } } as const)
    : ({ to: "/world/$worldId/world/card/$cardId", params: { worldId, cardId: id } } as const);
}
