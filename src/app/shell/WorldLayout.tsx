import { Outlet, useLocation, useMatches, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import { useUiStore } from "@/app/stores/ui";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { CardTypesDialog } from "@/features/card-types";
import { useCurrentWorld } from "@/features/world";
import { WorldSettingsDialog } from "@/features/world-settings";
import { usePageTransition } from "./navigation";
import { type ShellTab, TopBar } from "./TopBar";

export const SHELL_TABS = ["home", "world", "wiki", "quill"] as const satisfies readonly ShellTab[];

export function isShellTab(value: string): value is ShellTab {
  return (SHELL_TABS as readonly string[]).includes(value);
}

const TAB_ROUTES = {
  home: "/world/$worldId/home",
  world: "/world/$worldId/world",
  wiki: "/world/$worldId/wiki",
  quill: "/world/$worldId/quill",
} as const satisfies Record<ShellTab, string>;

/**
 * The side a tab's page comes from (Clément's decision, motion plan §8): from
 * the right when going to a later tab in the order Home, World, Wiki, Quill,
 * from the left when going back, from nowhere for a page outside the tabs.
 */
export function tabDirection(from: string | null, to: string | null): number {
  const before = SHELL_TABS.indexOf(from as ShellTab);
  const after = SHELL_TABS.indexOf(to as ShellTab);
  return before < 0 || after < 0 ? 0 : Math.sign(after - before);
}

/** "/world/<id>/<tab>/…" → the tab segment, if any. */
export function tabFromPath(pathname: string): ShellTab | undefined {
  const segment = pathname.split("/")[3];
  return segment !== undefined && isShellTab(segment) ? segment : undefined;
}

/**
 * Layout of an open world (ADR 0003): three-island top bar, then the active
 * tab's route. The tabs are driven by the URL. Ctrl+K opens the search.
 */
export function WorldLayout() {
  const { worldId } = useParams({ from: "/world/$worldId" });
  const pathTab = useLocation({ select: (location) => tabFromPath(location.pathname) });
  const tab = pathTab ?? "home";
  const navigate = useNavigate();
  const cardTypesOpen = useUiStore((state) => state.cardTypesOpen);
  const setCardTypesOpen = useUiStore((state) => state.setCardTypesOpen);
  const { data: world } = useCurrentWorld();
  const requestSearch = useUiStore((state) => state.requestSearch);
  // Another tab: the page enters from its side. The tab follows the URL at
  // once; the page, from the matches the router has finished loading, so
  // the old page stays, untouched, until the new one is there.
  const page = useRef<HTMLDivElement>(null);
  const shownTab = useMatches({
    select: (matches) => tabFromPath(matches.at(-1)?.pathname ?? "") ?? "page",
  });
  usePageTransition(page, shownTab, { target: "page", direction: tabDirection });

  // The global search: the World tab and its search field.
  const openSearch = useCallback(() => {
    if (pathTab !== "world") void navigate({ to: TAB_ROUTES.world, params: { worldId } });
    requestSearch();
  }, [pathTab, navigate, worldId, requestSearch]);

  // Ctrl+K, from anywhere in the world.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      if (event.altKey || event.shiftKey) return;
      event.preventDefault();
      openSearch();
    };
    // Capture: before an editor or a menu handles the keys itself.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [openSearch]);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        if (isShellTab(value)) void navigate({ to: TAB_ROUTES[value], params: { worldId } });
      }}
      className="flex h-full flex-col gap-2 p-2"
    >
      {/* The entry of the world: the bar, then the content, set down after the atlas. */}
      <div className="atlas-settle">
        <TopBar
          activeTab={tab}
          onSearch={openSearch}
          // A page outside the tabs (the media library, under Home) highlights
          // Home: a click on it must still lead back there. Within a tab (a card
          // in World), the click changes nothing.
          onTabClick={(value) => {
            if (pathTab !== value) void navigate({ to: TAB_ROUTES[value], params: { worldId } });
          }}
        />
      </div>
      <TabsContent value={tab} className="atlas-settle min-h-0 flex-1 [--bz-settle-step:1.5]">
        <div ref={page} className="h-full">
          <Outlet />
        </div>
      </TabsContent>
      <CardTypesDialog open={cardTypesOpen} onOpenChange={setCardTypesOpen} />
      {world && <WorldSettingsDialog world={world} />}
    </Tabs>
  );
}
