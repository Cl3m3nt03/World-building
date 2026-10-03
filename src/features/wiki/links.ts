import type { WikiPage } from "@/lib/bindings";
import { documentRoute } from "@/lib/documentRoute";

/**
 * Where a wiki page opens. Until the wiki has its own card and map pages
 * (M8, 8.4 and 8.5), the document in the World tab.
 */
export function pageRoute(worldId: string, page: WikiPage) {
  return documentRoute(worldId, page.kind, page.id);
}
