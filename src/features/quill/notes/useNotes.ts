import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { quillKeys } from "../hooks/useQuill";

/** The notes of a story, by chapter. */
export function useStoryNotes(storyId: string) {
  return useQuery({
    queryKey: quillKeys.notes(storyId),
    queryFn: () => unwrap(commands.storyNotes(storyId)),
  });
}

function useRefreshNotes(storyId: string) {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: quillKeys.notes(storyId) });
}

export function useCreateNote(storyId: string) {
  const refresh = useRefreshNotes(storyId);
  return useMutation({
    mutationFn: ({ draftId, body }: { draftId: string; body: string }) =>
      unwrap(commands.createNote(draftId, body)),
    onSuccess: refresh,
  });
}

export function useUpdateNote(storyId: string) {
  const refresh = useRefreshNotes(storyId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      unwrap(commands.updateNote(id, body)),
    onSuccess: refresh,
  });
}

export function useDeleteNote(storyId: string) {
  const refresh = useRefreshNotes(storyId);
  return useMutation({
    mutationFn: (id: string) => unwrap(commands.deleteNote(id)),
    onSuccess: refresh,
  });
}
