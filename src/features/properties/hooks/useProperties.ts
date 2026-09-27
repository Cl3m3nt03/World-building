import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  commands,
  type PropertyKind,
  type PropertyOwner,
  type PropertyValue,
} from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";

/** Query keys of the properties (see the conventions in src/lib/query.ts). */
export const propertyKeys = {
  all: () => ["properties"] as const,
  ofType: (typeId: string) => [...propertyKeys.all(), "type", typeId] as const,
  ofCard: (cardId: string) => [...propertyKeys.all(), "card", cardId] as const,
};

/** Properties defined on a type (not the inherited ones). */
export function useTypeProperties(typeId: string) {
  return useQuery({
    queryKey: propertyKeys.ofType(typeId),
    queryFn: () => unwrap(commands.listTypeProperties(typeId)),
  });
}

/** Properties a card shows, with its values. */
export function useCardProperties(cardId: string) {
  return useQuery({
    queryKey: propertyKeys.ofCard(cardId),
    queryFn: () => unwrap(commands.cardProperties(cardId)),
  });
}

/** Any change to a definition can change what every card shows. */
function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: propertyKeys.all() });
}

export function useCreateProperty() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      owner,
      label,
      kind,
    }: {
      owner: PropertyOwner;
      label: string;
      kind: PropertyKind;
    }) => unwrap(commands.createProperty(owner, label, kind)),
    onSuccess: invalidate,
  });
}

export function useRenameProperty() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      unwrap(commands.renameProperty(id, label)),
    onSuccess: invalidate,
  });
}

export function useSetPropertyKind() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, kind, targets }: { id: string; kind: PropertyKind; targets: string[] }) =>
      unwrap(commands.setPropertyKind(id, kind, targets)),
    onSuccess: invalidate,
  });
}

export function useApplyPropertyToExisting() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => unwrap(commands.applyPropertyToExisting(id)),
    onSuccess: invalidate,
  });
}

export function useDeleteProperty() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => unwrap(commands.deleteProperty(id)),
    onSuccess: invalidate,
  });
}

/** Values a property holds, to warn before deleting it. */
export function usePropertyValueCount(id: string | null) {
  return useQuery({
    queryKey: [...propertyKeys.all(), "valueCount", id],
    queryFn: () => unwrap(commands.countPropertyValues(id ?? "")),
    enabled: id !== null,
  });
}

export function useSetPropertyValue(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, value }: { propertyId: string; value: PropertyValue | null }) =>
      unwrap(commands.setPropertyValue(cardId, propertyId, value)),
    onSuccess: (properties) => {
      queryClient.setQueryData(propertyKeys.ofCard(cardId), properties);
      // Backlinks live under the documents' keys (features/cards).
      void queryClient.invalidateQueries({ queryKey: ["documents", "backlinks"] });
    },
  });
}
