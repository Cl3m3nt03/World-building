import { QueryClient } from "@tanstack/react-query";

/**
 * TanStack Query wraps the Tauri commands (src/lib/bindings.ts, from 0.8).
 *
 * Key conventions:
 * - A key starts with the domain, then narrows down: ["world", worldId],
 *   ["cards", worldId, "list", filters], ["cards", worldId, "detail", cardId].
 * - Each feature exposes its keys from one factory in
 *   src/features/<module>/hooks/keys.ts, e.g.
 *   `cardKeys.detail(worldId, cardId)`, so invalidation can target a prefix
 *   (`cardKeys.all(worldId)`) without hand-written arrays.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Local IPC: a failure is deterministic, retrying only delays the error.
        retry: false,
        // The Rust side owns the data and is the only writer: data stays fresh
        // until a mutation invalidates it.
        staleTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
