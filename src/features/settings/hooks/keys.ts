/** Query keys of app-level data (see the conventions in src/lib/query.ts). */
export const appKeys = {
  all: () => ["app"] as const,
  info: () => [...appKeys.all(), "info"] as const,
};
