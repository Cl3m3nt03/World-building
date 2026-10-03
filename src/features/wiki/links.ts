import { useCallback, useMemo } from "react";
import type { DocumentKind, WikiPage } from "@/lib/bindings";
import type { DocumentLinkResolver } from "@/lib/documentLinks";
import { documentRoute, wikiCardRoute } from "@/lib/documentRoute";
import { useWikiPages } from "./hooks/useWiki";

/**
 * Where a document opens from the wiki: a card's page in the wiki; a map,
 * until it has its page there (M8, 8.5), in World.
 */
function wikiRoute(worldId: string, kind: DocumentKind, id: string) {
  return kind === "card" ? wikiCardRoute(worldId, id) : documentRoute(worldId, kind, id);
}

/** Where a wiki page opens. */
export function pageRoute(worldId: string, page: WikiPage) {
  return wikiRoute(worldId, page.kind, page.id);
}

/**
 * The links of the wiki: a document with a page opens it, any other is
 * plain text, never a dead link.
 */
export function useWikiLinks(): {
  resolve: DocumentLinkResolver;
  isPage: (id: string) => boolean;
} {
  const pages = useWikiPages();
  const ids = useMemo(() => new Set(pages.data?.map((page) => page.id)), [pages.data]);
  const isPage = useCallback((id: string) => ids.has(id), [ids]);
  const resolve = useCallback<DocumentLinkResolver>(
    (worldId, kind, id) => (ids.has(id) ? wikiRoute(worldId, kind, id) : null),
    [ids],
  );
  return { resolve, isPage };
}
