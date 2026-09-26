import type { AssetFilter } from "@/lib/bindings";

/** Query keys of the media library (see the conventions in src/lib/query.ts). */
export const mediaKeys = {
  all: () => ["media"] as const,
  list: (filter: AssetFilter) => [...mediaKeys.all(), "list", filter] as const,
};
