import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { documentKeys } from "@/features/cards/hooks/keys";
import { commands, type GraphConfig } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";

/** Query keys of the graphs (see the conventions in src/lib/query.ts). */
export const graphKeys = {
  all: () => ["graphs"] as const,
  detail: (id: string) => [...graphKeys.all(), "detail", id] as const,
};

export function useGraph(id: string) {
  return useQuery({
    queryKey: graphKeys.detail(id),
    queryFn: () => unwrap(commands.getGraph(id)),
  });
}

/**
 * The cards and their links. Under the documents' key: a card created,
 * renamed or trashed, or a link added, refreshes it.
 */
export function useGraphData() {
  return useQuery({
    queryKey: [...documentKeys.all(), "graph-data"],
    queryFn: () => unwrap(commands.graphData()),
    staleTime: 0,
  });
}

/** Creates a graph ("Untitled graph", every card shown) and opens it. */
export function useCreateGraph() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    // The world the graph opens in, once created.
    mutationFn: (_worldId: string) => unwrap(commands.createGraph(t("graphs.untitled"))),
    onSuccess: async (graph, worldId) => {
      queryClient.setQueryData(graphKeys.detail(graph.id), graph);
      await queryClient.invalidateQueries({ queryKey: documentKeys.all() });
      await navigate({
        to: "/world/$worldId/world/graph/$graphId",
        params: { worldId, graphId: graph.id },
      });
    },
  });
}

export function useRenameGraph(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => unwrap(commands.renameDocument(id, title)),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: graphKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: documentKeys.all() }),
      ]),
  });
}

/** Saves the graph's configuration (filters, settings, pinned nodes, framing). */
export function useSaveGraph(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: GraphConfig) => unwrap(commands.saveGraph(id, config)),
    onSuccess: (_saved, config) =>
      queryClient.setQueryData(graphKeys.detail(id), (old: { config: GraphConfig } | undefined) =>
        old ? { ...old, config } : old,
      ),
  });
}
