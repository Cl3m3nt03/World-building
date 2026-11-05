import { createContext, useContext, useMemo } from "react";
import { useResolvedTheme } from "@/app/theme";
import { useCurrentWorld } from "@/features/world";
import type { WikiLook } from "../theme";

/** What the Atlas theme follows now: the open world's theme and the mode shown. */
export function useWikiLook(): WikiLook {
  const { data: world } = useCurrentWorld();
  const mode = useResolvedTheme();
  const theme = world?.theme ?? null;
  return useMemo(() => ({ world: theme, mode }), [theme, mode]);
}

/**
 * The `data-wiki-scheme` of the wiki's popovers and menus (they open outside
 * its root): the wiki's scheme when it differs from the mode shown, else
 * none, so that they keep the app's tokens and the world's material. Set by
 * WikiLayout.
 */
export const WikiPopoverScheme = createContext<"light" | "dark" | undefined>(undefined);

export function useWikiPopoverScheme(): "light" | "dark" | undefined {
  return useContext(WikiPopoverScheme);
}
