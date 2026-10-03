import type { QueryClient } from "@tanstack/react-query";
import {
  createHashHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
  redirect,
} from "@tanstack/react-router";
import { ErrorScreen, NotFoundScreen } from "@/app/ErrorScreen";
import { Backdrop } from "@/app/shell/Backdrop";
import { ComingSoon, StartWith, WorldWorkspace } from "@/app/shell/Workspace";
import { WorldLayout } from "@/app/shell/WorldLayout";
import { CanvasPage } from "@/features/canvases";
import { CardPage } from "@/features/cards";
import { GraphPage } from "@/features/graphs";
import { HomeScreen } from "@/features/home";
import { MapPage } from "@/features/maps";
import { MediaLibraryScreen } from "@/features/media";
import { sidebarStateQuery } from "@/features/sidebar";
import { TreePage } from "@/features/trees";
import { WikiCardPage, WikiHome, WikiLayout } from "@/features/wiki";
import { currentWorldQuery, WorldListScreen } from "@/features/world";

/*
 * Routes (code-based, fully typed):
 *   /                          world list (start screen)
 *   /world/$worldId            only if that world is open in Rust, else → /
 *                              → redirects to /world/$worldId/home
 *   /world/$worldId/home       Home tab
 *   /world/$worldId/world      World tab (sidebar + workspace)
 *     /card/$cardId            a card, in the workspace
 *     /map/$mapId              a map, in the workspace (M4)
 *     /graph/$graphId          a graph, in the workspace (M5)
 *     /tree/$treeId            a relation tree, in the workspace (M6)
 *     /canvas/$canvasId        a canvas, in the workspace (M7)
 *   /world/$worldId/wiki       Wiki tab: its home page (M8)
 *     /card/$cardId            a card's page in the wiki
 *   /world/$worldId/quill      Quill tab
 *   /world/$worldId/media      Media library (reached from Home)
 */

type RouterContext = { queryClient: QueryClient };

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Backdrop />
      <div className="relative h-screen w-screen">
        <Outlet />
      </div>
    </>
  ),
});

const worldListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: WorldListScreen,
});

const worldRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/world/$worldId",
  // The URL alone cannot open a world: back to the list unless it is the open one.
  beforeLoad: async ({ context, params }) => {
    const world = await context.queryClient.ensureQueryData(currentWorldQuery).catch(() => null);
    if (world?.id !== params.worldId) {
      throw redirect({ to: "/" });
    }
  },
  component: WorldLayout,
});

const worldIndexRoute = createRoute({
  getParentRoute: () => worldRoute,
  path: "/",
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/world/$worldId/home", params });
  },
});

const homeRoute = createRoute({
  getParentRoute: () => worldRoute,
  path: "home",
  component: HomeScreen,
});

const worldTabRoute = createRoute({
  getParentRoute: () => worldRoute,
  path: "world",
  // The sidebar's width and collapse are known before the panels are laid out.
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(sidebarStateQuery).catch(() => undefined),
  component: WorldWorkspace,
});

/** World tab with no document open: "Start with…". */
const worldTabIndexRoute = createRoute({
  getParentRoute: () => worldTabRoute,
  path: "/",
  component: StartWith,
});

const cardRoute = createRoute({
  getParentRoute: () => worldTabRoute,
  path: "card/$cardId",
  component: CardPage,
});

const mapRoute = createRoute({
  getParentRoute: () => worldTabRoute,
  path: "map/$mapId",
  component: MapPage,
});

const graphRoute = createRoute({
  getParentRoute: () => worldTabRoute,
  path: "graph/$graphId",
  component: GraphPage,
});

const treeRoute = createRoute({
  getParentRoute: () => worldTabRoute,
  path: "tree/$treeId",
  component: TreePage,
});

const canvasRoute = createRoute({
  getParentRoute: () => worldTabRoute,
  path: "canvas/$canvasId",
  component: CanvasPage,
});

const wikiRoute = createRoute({
  getParentRoute: () => worldRoute,
  path: "wiki",
  component: WikiLayout,
});

/** The wiki's home page (M8). */
const wikiHomeRoute = createRoute({
  getParentRoute: () => wikiRoute,
  path: "/",
  component: WikiHome,
});

/** A card's page in the wiki (M8). */
const wikiCardRoute = createRoute({
  getParentRoute: () => wikiRoute,
  path: "card/$cardId",
  component: WikiCardPage,
});

const quillRoute = createRoute({
  getParentRoute: () => worldRoute,
  path: "quill",
  component: () => (
    <ComingSoon title="shell.tabs.quill" description="placeholder.quill" milestone="M9" />
  ),
});

const mediaRoute = createRoute({
  getParentRoute: () => worldRoute,
  path: "media",
  component: MediaLibraryScreen,
});

export const routeTree = rootRoute.addChildren([
  worldListRoute,
  worldRoute.addChildren([
    worldIndexRoute,
    homeRoute,
    worldTabRoute.addChildren([
      worldTabIndexRoute,
      cardRoute,
      mapRoute,
      graphRoute,
      treeRoute,
      canvasRoute,
    ]),
    wikiRoute.addChildren([wikiHomeRoute, wikiCardRoute]),
    quillRoute,
    mediaRoute,
  ]),
]);

/**
 * Hash history: the desktop app has no server to rewrite deep links, and a
 * reload keeps the current route.
 */
export function createAppRouter(
  queryClient: QueryClient,
  history: RouterHistory = createHashHistory(),
) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient },
    defaultErrorComponent: ({ error }) => <ErrorScreen error={error} />,
    defaultNotFoundComponent: NotFoundScreen,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
