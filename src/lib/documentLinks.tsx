import { useParams } from "@tanstack/react-router";
import { createContext, useCallback, useContext } from "react";
import type { DocumentKind } from "./bindings";
import {
  documentRoute,
  type timelineCardRoute,
  type wikiCardRoute,
  type wikiMapRoute,
  type wikiTimelineRoute,
} from "./documentRoute";

export type DocumentLink =
  | ReturnType<typeof documentRoute>
  | ReturnType<typeof wikiCardRoute>
  | ReturnType<typeof wikiMapRoute>
  | ReturnType<typeof wikiTimelineRoute>
  | ReturnType<typeof timelineCardRoute>;

/** Where a document opens, or `null`: shown as plain text, not as a link. */
export type DocumentLinkResolver = (
  worldId: string,
  kind: DocumentKind,
  id: string,
) => DocumentLink | null;

/**
 * Where the links to documents lead in the components shared by World and
 * the wiki (properties, "Cité dans", map blocks). World: the document's page
 * there. The wiki provides its own: a visible page, or plain text.
 */
export const DocumentLinkContext = createContext<DocumentLinkResolver>(documentRoute);

/**
 * Whether Quill chapters show where documents citing a card are listed
 * ("Cité dans"), opening in Quill. The wiki hides them: stories are not
 * pages of the wiki.
 */
export const ChapterLinksContext = createContext(true);

/** Where a chapter of a story opens: its page in Quill. */
export function chapterRoute(worldId: string, storyId: string, chapterId: string) {
  return {
    to: "/world/$worldId/quill/story/$storyId/chapter/$chapterId",
    params: { worldId, storyId, chapterId },
  } as const;
}

/** The link of a document of the open world, or `null` (plain text). */
export function useDocumentLink() {
  const { worldId } = useParams({ from: "/world/$worldId" });
  const resolve = useContext(DocumentLinkContext);
  return useCallback(
    (kind: DocumentKind, id: string) => resolve(worldId, kind, id),
    [resolve, worldId],
  );
}
