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
import { StartWith, WorldWorkspace } from "@/app/shell/Workspace";
import { WorldLayout } from "@/app/shell/WorldLayout";
import { CanvasPage } from "@/features/canvases";
import { CardPage } from "@/features/cards";
import { GraphPage } from "@/features/graphs";
import { HomeScreen } from "@/features/home";
import { MapPage } from "@/features/maps";
import { MediaLibraryScreen } from "@/features/media";
import {
  EditStoryPage,
  type Mode,
  NewStoryPage,
  readMode,
  StoriesScreen,
  StoryIndexPage,
  WritingSpace,
} from "@/features/quill";
import { sidebarStateQuery } from "@/features/sidebar";
import { TimelinePage } from "@/features/timelines";
import { TreePage } from "@/features/trees";
import { WikiCardPage, WikiHome, WikiLayout, WikiMapPage, WikiTimelinePage } from "@/features/wiki";
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
 *     /timeline/$timelineId    a timeline, in the workspace (M11)
 *   /world/$worldId/wiki       Wiki tab: its home page (M8)
 *     /card/$cardId            a card's page in the wiki
 *     /map/$mapId              a map's page in the wiki
 *     /timeline/$timelineId    a timeline's page in the wiki (M11)
 *   /world/$worldId/quill      Quill tab: the stories (M9)
 *     /new                     a new story's book
 *     /story/$storyId          a story → its first chapter
 *       /edit                  its book
 *       /chapter/$chapterId    a chapter, in the writing space
 *         /draft/$draftId      one of its other drafts
 *         /compare/$l/$r       two of its drafts side by side
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

/** A timeline (M11); `?card=` centres it on that card's item (from « Cité dans »). */
const timelineRoute = createRoute({
  getParentRoute: () => worldTabRoute,
  path: "timeline/$timelineId",
  component: TimelinePage,
  validateSearch: (search: Record<string, unknown>): { card?: string } =>
    typeof search.card === "string" && search.card !== "" ? { card: search.card } : {},
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

/** A map's page in the wiki (M8). */
const wikiMapRoute = createRoute({
  getParentRoute: () => wikiRoute,
  path: "map/$mapId",
  component: WikiMapPage,
});

/** A timeline's page in the wiki (M11). */
const wikiTimelineRoute = createRoute({
  getParentRoute: () => wikiRoute,
  path: "timeline/$timelineId",
  component: WikiTimelinePage,
});

const quillRoute = createRoute({
  getParentRoute: () => worldRoute,
  path: "quill",
});

/** Quill (M9): the stories. */
const quillIndexRoute = createRoute({
  getParentRoute: () => quillRoute,
  path: "/",
  component: StoriesScreen,
});

const newStoryRoute = createRoute({
  getParentRoute: () => quillRoute,
  path: "new",
  component: NewStoryPage,
});

const storyRoute = createRoute({
  getParentRoute: () => quillRoute,
  path: "story/$storyId",
});

const storyIndexRoute = createRoute({
  getParentRoute: () => storyRoute,
  path: "/",
  component: StoryIndexPage,
});

const editStoryRoute = createRoute({
  getParentRoute: () => storyRoute,
  path: "edit",
  component: EditStoryPage,
});

/**
 * The mode of the writing space (M10): writing when absent, else placing
 * sounds, reading with them or publishing (`?mode=publish`).
 */
function modeSearch(search: Record<string, unknown>): { mode?: Exclude<Mode, "write"> } {
  const mode = readMode(search.mode);
  return mode === "write" ? {} : { mode };
}

const chapterRoute = createRoute({
  getParentRoute: () => storyRoute,
  path: "chapter/$chapterId",
  component: WritingSpace,
  validateSearch: modeSearch,
});

/** A draft of a chapter that is not its current one (M9). */
const draftRoute = createRoute({
  getParentRoute: () => storyRoute,
  path: "chapter/$chapterId/draft/$draftId",
  component: WritingSpace,
  validateSearch: modeSearch,
});

/** Two drafts of a chapter, side by side (M9). */
const compareRoute = createRoute({
  getParentRoute: () => storyRoute,
  path: "chapter/$chapterId/compare/$leftId/$rightId",
  component: WritingSpace,
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
      timelineRoute,
    ]),
    wikiRoute.addChildren([wikiHomeRoute, wikiCardRoute, wikiMapRoute, wikiTimelineRoute]),
    quillRoute.addChildren([
      quillIndexRoute,
      newStoryRoute,
      storyRoute.addChildren([
        storyIndexRoute,
        editStoryRoute,
        chapterRoute,
        draftRoute,
        compareRoute,
      ]),
    ]),
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
