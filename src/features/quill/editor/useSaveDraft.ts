import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { documentKeys } from "@/features/cards";
import { commands, type Draft, type DraftInfo, type StoryOutline } from "@/lib/bindings";
import { saveContent } from "@/lib/contentSaves";
import { unwrap } from "@/lib/ipc";
import { quillKeys } from "../hooks/useQuill";

/** The outline as a draft save left it: its words in its chapter and story. */
function withSaved(outline: StoryOutline, saved: DraftInfo): StoryOutline {
  let delta = 0;
  const chapters = outline.chapters.map((chapter) => {
    if (!chapter.drafts.some((draft) => draft.id === saved.id)) return chapter;
    const drafts = chapter.drafts.map((draft) => (draft.id === saved.id ? saved : draft));
    if (chapter.currentDraftId !== saved.id) return { ...chapter, drafts };
    delta = saved.wordCount - chapter.wordCount;
    return { ...chapter, drafts, wordCount: saved.wordCount };
  });
  return {
    story: { ...outline.story, wordCount: outline.story.wordCount + delta },
    chapters,
  };
}

/**
 * Saves a draft's text. It is put in the cache as its save starts, not once
 * it is done: the editor saves on its way out, and the next editor of the
 * draft starts from the cache at once (#586). A failed save puts back the
 * last saved text, unless a later save has started (see `saveContent`). The
 * saves of a draft run one after the other, in the order they were sent.
 */
export function useSaveDraft(storyId: string, draftId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (content: string) => unwrap(commands.saveDraft(draftId, content)),
    scope: { id: `draft:${draftId}` },
    onSuccess: (saved) => {
      queryClient.setQueryData<Draft>(quillKeys.draft(draftId), (draft) =>
        draft ? { ...draft, wordCount: saved.wordCount } : draft,
      );
      queryClient.setQueryData<StoryOutline>(quillKeys.outline(storyId), (outline) =>
        outline ? withSaved(outline, saved) : outline,
      );
      void queryClient.invalidateQueries({ queryKey: quillKeys.stories() });
      // The chapter's mentions may have changed: « Cité dans » of the cards.
      void queryClient.invalidateQueries({ queryKey: [...documentKeys.all(), "backlinks"] });
    },
  });
  const { mutateAsync } = mutation;
  const save = useCallback(
    (content: string) => {
      const key = quillKeys.draft(draftId);
      return saveContent(
        `draft:${draftId}`,
        content,
        {
          read: () => queryClient.getQueryData<Draft>(key)?.content,
          write: (text) =>
            queryClient.setQueryData<Draft>(key, (draft) => draft && { ...draft, content: text }),
          reload: () => void queryClient.invalidateQueries({ queryKey: key, exact: true }),
        },
        () => mutateAsync(content),
      );
    },
    [draftId, queryClient, mutateAsync],
  );
  return { save, error: mutation.error };
}
