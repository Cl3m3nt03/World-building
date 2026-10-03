import { useCallback, useMemo } from "react";
import type { DocumentKind, WikiPage } from "@/lib/bindings";
import type { DocumentLinkResolver } from "@/lib/documentLinks";
import { documentRoute, wikiCardRoute, wikiMapRoute } from "@/lib/documentRoute";
import { useWikiPages } from "./hooks/useWiki";

/**
 * Where a document opens from the wiki: its page there. Only cards and maps
 * have one; another kind (never a page) would open in World.
 */
function wikiRoute(worldId: string, kind: DocumentKind, id: string) {
  if (kind === "card") return wikiCardRoute(worldId, id);
  if (kind === "map") return wikiMapRoute(worldId, id);
  return documentRoute(worldId, kind, id);
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
