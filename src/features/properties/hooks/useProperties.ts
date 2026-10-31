import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CardProperty,
  commands,
  type PropertyDefinition,
  type PropertyKind,
  type PropertyOptionInput,
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

/** Replaces the choices of a select property; one left out leaves the cards. */
export function useSetPropertyOptions() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      options,
      multiple,
    }: {
      id: string;
      options: PropertyOptionInput[];
      multiple: boolean;
    }) => unwrap(commands.setPropertyOptions(id, options, multiple)),
    onSuccess: invalidate,
  });
}

/** Cards holding a choice, asked just before removing it. */
export function useCountOptionValues() {
  return useMutation({
    mutationFn: ({ id, optionId }: { id: string; optionId: string }) =>
      unwrap(commands.countPropertyOptionValues(id, optionId)),
  });
}

/** Makes a link property a relation of the world (`null`: just a link). */
export function useSetPropertyRelation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, relationTypeId }: { id: string; relationTypeId: string | null }) =>
      unwrap(commands.setPropertyRelation(id, relationTypeId)),
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

/** `items` with those named by `ids` in that order; the others keep their place. */
function inOrder<T>(items: T[], ids: string[], idOf: (item: T) => string): T[] {
  const byId = new Map(items.map((item) => [idOf(item), item]));
  let next = 0;
  return items.map((item) => {
    if (!ids.includes(idOf(item))) return item;
    const id = ids[next];
    next += 1;
    return (id !== undefined && byId.get(id)) || item;
  });
}

const reorderKey = () => [...propertyKeys.all(), "reorder"] as const;

/**
 * Sends a new order, already shown in the list under `queryKey`. The list
 * changes before the mutation starts: a row moved later would lose the focus
 * that the drag has just given back to its handle. Moves run one after the
 * other, the lists are read back after the last one, and a failure brings the
 * saved order back.
 */
function useReorder<T>(queryKey: QueryKey, idOf: (item: T) => string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const mutation = useMutation({
    mutationKey: reorderKey(),
    scope: { id: "properties-reorder" },
    mutationFn: (ids: string[]) => unwrap(commands.reorderProperties(ids)),
    onSettled: () =>
      queryClient.isMutating({ mutationKey: reorderKey() }) === 1 ? invalidate() : undefined,
  });
  const reorder = (ids: string[]) => {
    void queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData<T[]>(queryKey, (items) => items && inOrder(items, ids, idOf));
    mutation.mutate(ids);
  };
  return { reorder, error: mutation.error };
}

/** Orders a type's properties; the cards of the type follow. */
export function useReorderTypeProperties(typeId: string) {
  return useReorder(propertyKeys.ofType(typeId), (property: PropertyDefinition) => property.id);
}

/** Orders the properties a card owns; those of its type do not move. */
export function useReorderCardProperties(cardId: string) {
  return useReorder(
    propertyKeys.ofCard(cardId),
    (property: CardProperty) => property.definition.id,
  );
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
