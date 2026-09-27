import { Outlet, useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { useUiStore } from "@/app/stores/ui";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { CardTypesDialog } from "@/features/card-types";
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

/** "/world/<id>/<tab>/…" → the tab segment, if any. */
export function tabFromPath(pathname: string): ShellTab | undefined {
  const segment = pathname.split("/")[3];
  return segment !== undefined && isShellTab(segment) ? segment : undefined;
}

/**
 * Layout of an open world (ADR 0003): three-island top bar, then the active
 * tab's route. The tabs are driven by the URL.
 */
export function WorldLayout() {
  const { worldId } = useParams({ from: "/world/$worldId" });
  const tab = useLocation({ select: (location) => tabFromPath(location.pathname) }) ?? "home";
  const navigate = useNavigate();
  const cardTypesOpen = useUiStore((state) => state.cardTypesOpen);
  const setCardTypesOpen = useUiStore((state) => state.setCardTypesOpen);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        if (isShellTab(value)) void navigate({ to: TAB_ROUTES[value], params: { worldId } });
      }}
      className="flex h-full flex-col gap-2 p-2"
    >
      <TopBar activeTab={tab} />
      <TabsContent value={tab} className="min-h-0 flex-1">
        <Outlet />
      </TabsContent>
      <CardTypesDialog open={cardTypesOpen} onOpenChange={setCardTypesOpen} />
    </Tabs>
  );
}
