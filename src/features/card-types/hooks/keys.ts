/** Query keys of the card types (see the conventions in src/lib/query.ts). */
export const cardTypeKeys = {
  all: () => ["cardTypes"] as const,
  list: () => [...cardTypeKeys.all(), "list"] as const,
};
