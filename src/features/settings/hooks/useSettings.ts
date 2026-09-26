import { useQuery } from "@tanstack/react-query";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { appKeys } from "./keys";

/** App settings: preferences and recent worlds. */
export function useSettings() {
  return useQuery({
    queryKey: appKeys.settings(),
    queryFn: () => unwrap(commands.getSettings()),
  });
}
