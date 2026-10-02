import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { documentKeys } from "@/features/cards/hooks/keys";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";

/** Query keys of the relation trees (see the conventions in src/lib/query.ts). */
export const treeKeys = {
  all: () => ["trees"] as const,
  detail: (id: string) => [...treeKeys.all(), "detail", id] as const,
  relationTypes: () => [...treeKeys.all(), "relation-types"] as const,
};

export function useTree(id: string) {
  return useQuery({
    queryKey: treeKeys.detail(id),
    queryFn: () => unwrap(commands.getTree(id)),
  });
}

/** The world's relation types, provided ones first. */
export function useRelationTypes() {
  return useQuery({
    queryKey: treeKeys.relationTypes(),
    queryFn: () => unwrap(commands.listRelationTypes()),
  });
}

/** Creates a tree (one variant, one empty node) and opens it. */
export function useCreateTree() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    // The world the tree opens in, once created.
    mutationFn: (_worldId: string) =>
      unwrap(commands.createTree(t("trees.untitled"), t("trees.variants.first"))),
    onSuccess: async (tree, worldId) => {
      queryClient.setQueryData(treeKeys.detail(tree.id), tree);
      await queryClient.invalidateQueries({ queryKey: documentKeys.all() });
      await navigate({
        to: "/world/$worldId/world/tree/$treeId",
        params: { worldId, treeId: tree.id },
      });
    },
  });
}

export function useRenameTree(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => unwrap(commands.renameDocument(id, title)),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: treeKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: documentKeys.all() }),
      ]),
  });
}
