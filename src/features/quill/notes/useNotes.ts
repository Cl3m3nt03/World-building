import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { commands, type StoryNote } from "@/lib/bindings";
import { saveContent } from "@/lib/contentSaves";
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

/** The saves and the deletion of a note run one after the other, in order. */
const noteScope = (noteId: string) => ({ id: `note:${noteId}` });

/**
 * Saves a note's text. Its popover saves on its way out (Escape, a click
 * outside, the chapter left), so the text is put in the cache of the
 * story's notes as its save starts: the note reopened at once shows it
 * (#609). A failed save puts back the last saved text, unless a later save
 * has started (see `saveContent`).
 */
export function useSaveNote(storyId: string, noteId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: string) => unwrap(commands.updateNote(noteId, body)),
    scope: noteScope(noteId),
    // The text is in the cache already: only its date changes. No reading
    // of the notes again, which could come back with an older text while a
    // later save is on its way.
    onSuccess: (saved) =>
      queryClient.setQueryData<StoryNote[]>(quillKeys.notes(storyId), (notes) =>
        notes?.map((note) => (note.id === noteId ? { ...note, updatedAt: saved.updatedAt } : note)),
      ),
  });
  const { mutateAsync } = mutation;
  const save = useCallback(
    (body: string) => {
      const key = quillKeys.notes(storyId);
      return saveContent(
        `note:${noteId}`,
        body,
        {
          read: () =>
            queryClient.getQueryData<StoryNote[]>(key)?.find((note) => note.id === noteId)?.body,
          write: (text) =>
            queryClient.setQueryData<StoryNote[]>(key, (notes) =>
              notes?.map((note) => (note.id === noteId ? { ...note, body: text } : note)),
            ),
          reload: () => void queryClient.invalidateQueries({ queryKey: key, exact: true }),
        },
        () => mutateAsync(body),
      );
    },
    [storyId, noteId, queryClient, mutateAsync],
  );
  return { save, error: mutation.error };
}

/** Deletes a note, after the saves of its text already sent. */
export function useDeleteNote(storyId: string, noteId: string) {
  const refresh = useRefreshNotes(storyId);
  return useMutation({
    mutationFn: () => unwrap(commands.deleteNote(noteId)),
    scope: noteScope(noteId),
    onSuccess: refresh,
  });
}
