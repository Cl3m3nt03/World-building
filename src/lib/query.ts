import { QueryClient } from "@tanstack/react-query";

/**
 * TanStack Query wraps the Tauri commands (src/lib/bindings.ts, from 0.8).
 *
 * Key conventions:
 * - A key starts with the domain, then narrows down: ["cards", "list",
 *   filters], ["cards", "detail", cardId].
 * - Each feature exposes its keys from one factory in
 *   src/features/<module>/hooks/keys.ts, e.g. `cardKeys.detail(cardId)`, so
 *   invalidation can target a prefix (`cardKeys.all()`) without hand-written
 *   arrays.
 * - Keys do not carry the world id: one world is open at a time, and
 *   everything but the "app" and "world" roots is removed from the cache
 *   when the world changes (`forgetWorldData`, features/world).
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
