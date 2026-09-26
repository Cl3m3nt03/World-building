/** Query keys of the open world (see the conventions in src/lib/query.ts). */
export const worldKeys = {
  all: () => ["world"] as const,
  current: () => [...worldKeys.all(), "current"] as const,
  missing: () => [...worldKeys.all(), "missing"] as const,
};
