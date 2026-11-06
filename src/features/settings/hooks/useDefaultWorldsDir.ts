import { useQuery } from "@tanstack/react-query";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { appKeys } from "./keys";

/**
 * The folder new worlds go to when none is chosen, from Rust: `Documents\Atlasaga`,
 * or `Documents\BuilderZ` for someone who used the app before the rename (ADR 0016).
 */
export function useDefaultWorldsDir({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: appKeys.defaultWorldsDir(),
    queryFn: () => unwrap(commands.defaultWorldsDir()),
    enabled,
  });
}
