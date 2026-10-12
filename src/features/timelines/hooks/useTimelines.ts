import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { documentKeys } from "@/features/cards/hooks/keys";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";

/** Query keys of the timelines (see the conventions in src/lib/query.ts). */
export const timelineKeys = {
  all: () => ["timelines"] as const,
  detail: (id: string) => [...timelineKeys.all(), "detail", id] as const,
};

export function useTimeline(id: string) {
  return useQuery({
    queryKey: timelineKeys.detail(id),
    queryFn: () => unwrap(commands.getTimeline(id)),
  });
}

/** Creates a timeline (one track) and opens it. */
export function useCreateTimeline() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    // The world the timeline opens in, once created.
    mutationFn: (_worldId: string) =>
      unwrap(commands.createTimeline(t("timelines.untitled"), t("timelines.firstTrack"))),
    onSuccess: async (timeline, worldId) => {
      queryClient.setQueryData(timelineKeys.detail(timeline.id), timeline);
      await queryClient.invalidateQueries({ queryKey: documentKeys.all() });
      await navigate({
        to: "/world/$worldId/world/timeline/$timelineId",
        params: { worldId, timelineId: timeline.id },
      });
    },
  });
}

export function useRenameTimeline(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => unwrap(commands.renameDocument(id, title)),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: timelineKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: documentKeys.all() }),
      ]),
  });
}
