import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
  redirect,
} from "@tanstack/react-router";
import { ErrorScreen, NotFoundScreen } from "@/app/ErrorScreen";
import { Backdrop } from "@/app/shell/Backdrop";
import { ComingSoon, HomePlaceholder, WorldWorkspace } from "@/app/shell/Workspace";
import { WorldLayout } from "@/app/shell/WorldLayout";
import { WorldListScreen } from "@/features/world";

/*
 * Routes (code-based, fully typed):
 *   /                          world list (start screen)
 *   /world/$worldId            → redirects to /world/$worldId/home
 *   /world/$worldId/home       Home tab
 *   /world/$worldId/world      World tab (sidebar + workspace)
 *   /world/$worldId/wiki       Wiki tab
 *   /world/$worldId/quill      Quill tab
 */

const rootRoute = createRootRoute({
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
  component: HomePlaceholder,
});

const worldTabRoute = createRoute({
  getParentRoute: () => worldRoute,
  path: "world",
  component: WorldWorkspace,
});

const wikiRoute = createRoute({
  getParentRoute: () => worldRoute,
  path: "wiki",
  component: () => <ComingSoon title="shell.tabs.wiki" />,
});

const quillRoute = createRoute({
  getParentRoute: () => worldRoute,
  path: "quill",
  component: () => <ComingSoon title="shell.tabs.quill" />,
});

export const routeTree = rootRoute.addChildren([
  worldListRoute,
  worldRoute.addChildren([worldIndexRoute, homeRoute, worldTabRoute, wikiRoute, quillRoute]),
]);

/**
 * Hash history: the desktop app has no server to rewrite deep links, and a
 * reload keeps the current route.
 */
export function createAppRouter(history: RouterHistory = createHashHistory()) {
  return createRouter({
    routeTree,
    history,
    defaultErrorComponent: ({ error }) => <ErrorScreen error={error} />,
    defaultNotFoundComponent: NotFoundScreen,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
