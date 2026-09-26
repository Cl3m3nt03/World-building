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
import { ComingSoon, WorldWorkspace } from "@/app/shell/Workspace";
import { WorldLayout } from "@/app/shell/WorldLayout";
import { HomeScreen } from "@/features/home";
import { MediaLibraryScreen } from "@/features/media";
import { currentWorldQuery, WorldListScreen } from "@/features/world";

/*
 * Routes (code-based, fully typed):
 *   /                          world list (start screen)
 *   /world/$worldId            only if that world is open in Rust, else → /
 *                              → redirects to /world/$worldId/home
 *   /world/$worldId/home       Home tab
 *   /world/$worldId/world      World tab (sidebar + workspace)
 *   /world/$worldId/wiki       Wiki tab
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
  component: WorldWorkspace,
});

const wikiRoute = createRoute({
  getParentRoute: () => worldRoute,
  path: "wiki",
  component: () => (
    <ComingSoon title="shell.tabs.wiki" description="placeholder.wiki" milestone="M8" />
  ),
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
    worldTabRoute,
    wikiRoute,
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
