import { useQuery } from "@tanstack/react-query";
import { type AssetFilter, commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { mediaKeys } from "./keys";

/** Assets of the open world, newest first. */
export function useAssets(filter: AssetFilter) {
  return useQuery({
    queryKey: mediaKeys.list(filter),
    queryFn: () => unwrap(commands.listAssets(filter)),
  });
}
