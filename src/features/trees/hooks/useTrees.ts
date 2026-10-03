import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { documentKeys } from "@/features/cards/hooks/keys";
import { commands, type RelationTypeInput } from "@/lib/bindings";
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

/**
 * The relations the world already knows between its cards (trees and
 * relation properties, ADR 0007); under the documents, so that any change
 * of cards or links reads them again.
 */
export function useKnownRelations() {
  return useQuery({
    queryKey: [...documentKeys.all(), "known-relations"],
    queryFn: () => unwrap(commands.knownRelations()),
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

/** Creates a relation type of the world (a custom one, from a tree). */
export function useCreateRelationType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RelationTypeInput) => unwrap(commands.createRelationType(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.relationTypes() }),
  });
}

/** Changes a relation type of the world (name, icon, category, inverse). */
export function useUpdateRelationType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RelationTypeInput }) =>
      unwrap(commands.updateRelationType(id, input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.relationTypes() }),
  });
}

/**
 * Deletes a relation type of the world: its links become « without type »
 * in every tree. `beforeDelete` saves what waits (it must not name the type
 * any more once it is gone); `afterDelete` clears it from what is open.
 */
export function useDeleteRelationType(
  beforeDelete: () => Promise<unknown> | undefined,
  afterDelete: (id: string) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await beforeDelete();
      return unwrap(commands.deleteRelationType(id));
    },
    onSuccess: async (_, id) => {
      afterDelete(id);
      // The other trees, kept from an earlier visit, still name the type:
      // they are read again when next opened (an editor starts from them).
      queryClient.removeQueries({ queryKey: treeKeys.all(), type: "inactive" });
      await queryClient.invalidateQueries({ queryKey: treeKeys.relationTypes() });
    },
  });
}
