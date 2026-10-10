import type { Chapter } from "@/lib/bindings";

/**
 * Where a draft opens: its chapter's page for the current draft, else the
 * draft's own page.
 */
export function draftRoute(worldId: string, chapter: Chapter, draftId: string) {
  if (draftId === chapter.currentDraftId) {
    return {
      to: "/world/$worldId/quill/story/$storyId/chapter/$chapterId",
      params: { worldId, storyId: chapter.storyId, chapterId: chapter.id },
    } as const;
  }
  return {
    to: "/world/$worldId/quill/story/$storyId/chapter/$chapterId/draft/$draftId",
    params: { worldId, storyId: chapter.storyId, chapterId: chapter.id, draftId },
  } as const;
}
