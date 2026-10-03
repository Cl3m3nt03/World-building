import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { documentKeys } from "@/features/cards/hooks/keys";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";

/** Query keys of the canvases (see the conventions in src/lib/query.ts). */
export const canvasKeys = {
  all: () => ["canvases"] as const,
  detail: (id: string) => [...canvasKeys.all(), "detail", id] as const,
};

export function useCanvas(id: string) {
  return useQuery({
    queryKey: canvasKeys.detail(id),
    queryFn: () => unwrap(commands.getCanvas(id)),
    // The editor starts from it once: no refetch under its feet.
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** Creates an empty canvas and opens it. */
export function useCreateCanvas() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    // The world the canvas opens in, once created.
    mutationFn: (_worldId: string) => unwrap(commands.createCanvas(t("canvases.untitled"))),
    onSuccess: async (canvas, worldId) => {
      queryClient.setQueryData(canvasKeys.detail(canvas.id), canvas);
      await queryClient.invalidateQueries({ queryKey: documentKeys.all() });
      await navigate({
        to: "/world/$worldId/world/canvas/$canvasId",
        params: { worldId, canvasId: canvas.id },
      });
    },
  });
}

export function useRenameCanvas(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => unwrap(commands.renameDocument(id, title)),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: canvasKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: documentKeys.all() }),
      ]),
  });
}
