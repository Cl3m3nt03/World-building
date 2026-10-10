import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { documentKeys } from "@/features/cards/hooks/keys";
import { mediaKeys } from "@/features/media";
import {
  type Chapter,
  commands,
  type NewStory,
  type StoryOutline,
  type StoryPatch,
} from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";

/**
 * Quill's data (M9, ADR 0009): the stories, a story's outline (its chapters
 * and their drafts) and each draft's content.
 */
export const quillKeys = {
  all: () => ["quill"] as const,
  stories: () => [...quillKeys.all(), "stories"] as const,
  outline: (id: string) => [...quillKeys.all(), "outline", id] as const,
  draft: (id: string) => [...quillKeys.all(), "draft", id] as const,
};

export function useStories() {
  return useQuery({
    queryKey: quillKeys.stories(),
    queryFn: () => unwrap(commands.listStories()),
  });
}

export function useStoryOutline(id: string) {
  return useQuery({
    queryKey: quillKeys.outline(id),
    queryFn: () => unwrap(commands.storyOutline(id)),
  });
}

/** After a change: the stories' list, and what links to cards ("Cité dans"). */
function useRefresh() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: quillKeys.all() });
    void queryClient.invalidateQueries({ queryKey: documentKeys.all() });
    void queryClient.invalidateQueries({ queryKey: mediaKeys.all() });
  };
}

export function useCreateStory() {
  const refresh = useRefresh();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (story: NewStory) => unwrap(commands.createStory(story)),
    onSuccess: (outline: StoryOutline) => {
      queryClient.setQueryData(quillKeys.outline(outline.story.id), outline);
      refresh();
    },
  });
}

export function useUpdateStory() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: StoryPatch }) =>
      unwrap(commands.updateStory(id, patch)),
    onSuccess: refresh,
  });
}

export function useDeleteStory() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => unwrap(commands.deleteStory(id)),
    onSuccess: refresh,
  });
}

/** The outline as a change left it (a chapter changed), then read again. */
export function useChapterChange<T>(run: (input: T) => Promise<Chapter | StoryOutline>) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: run, onSuccess: refresh });
}
