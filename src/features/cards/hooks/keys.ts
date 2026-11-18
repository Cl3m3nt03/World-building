/** Query keys of the cards and documents (see the conventions in src/lib/query.ts). */
export const cardKeys = {
  all: () => ["cards"] as const,
  detail: (id: string) => [...cardKeys.all(), "detail", id] as const,
};

export const documentKeys = {
  all: () => ["documents"] as const,
  /** Search results, by query (sidebar and wiki, see useSearch). */
  search: () => [...documentKeys.all(), "search"] as const,
};
