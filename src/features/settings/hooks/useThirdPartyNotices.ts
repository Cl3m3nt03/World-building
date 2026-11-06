import { useQuery } from "@tanstack/react-query";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { parseNotices } from "../notices";
import { appKeys } from "./keys";

/** The third-party notices shipped with the app, read once and parsed. */
export function useThirdPartyNotices() {
  return useQuery({
    queryKey: appKeys.notices(),
    queryFn: async () => parseNotices(await unwrap(commands.thirdPartyNotices())),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
