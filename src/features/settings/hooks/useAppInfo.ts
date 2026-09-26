import { useQuery } from "@tanstack/react-query";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { appKeys } from "./keys";

/** Version and system directories, from the `app_info` Rust command. */
export function useAppInfo({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: appKeys.info(),
    queryFn: () => unwrap(commands.appInfo()),
    enabled,
  });
}
