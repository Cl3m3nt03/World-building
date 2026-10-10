import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mediaKeys } from "@/features/media";
import { type CueKind, type CuePatch, commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { quillKeys } from "../hooks/useQuill";

export const cueKeys = {
  draft: (draftId: string) => [...quillKeys.all(), "cues", draftId] as const,
};

/** The sounds of a draft. */
export function useDraftCues(draftId: string) {
  return useQuery({
    queryKey: cueKeys.draft(draftId),
    queryFn: () => unwrap(commands.draftAudioCues(draftId)),
    enabled: draftId !== "",
  });
}

function useRefresh(draftId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: cueKeys.draft(draftId) });
    // « Utilisé par » of the sounds' files.
    void queryClient.invalidateQueries({ queryKey: mediaKeys.all() });
  };
}

export function useCreateCue(draftId: string) {
  const refresh = useRefresh(draftId);
  return useMutation({
    mutationFn: ({ kind, assetId }: { kind: CueKind; assetId: string }) =>
      unwrap(commands.createAudioCue(draftId, kind, assetId)),
    onSuccess: refresh,
  });
}

export function useUpdateCue(draftId: string) {
  const refresh = useRefresh(draftId);
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CuePatch }) =>
      unwrap(commands.updateAudioCue(id, patch)),
    onSuccess: refresh,
  });
}

export function useDeleteCue(draftId: string) {
  const refresh = useRefresh(draftId);
  return useMutation({
    mutationFn: (id: string) => unwrap(commands.deleteAudioCue(id)),
    onSuccess: refresh,
  });
}
