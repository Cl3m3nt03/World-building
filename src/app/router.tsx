import type { EnsureQueryDataOptions, QueryClient } from "@tanstack/react-query";
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
import { RouteAnnouncer } from "@/app/shell/RouteAnnouncer";
import { StartWith, WorldWorkspace } from "@/app/shell/Workspace";
import { WorldLayout } from "@/app/shell/WorldLayout";
import { WorldRail } from "@/app/shell/WorldRail";
import { useUiStore } from "@/app/stores/ui";
import { CanvasPage, canvasQuery } from "@/features/canvases";
import { cardTypesQuery } from "@/features/card-types";
import {
  backlinksQuery,
  CardPage,
  cardContentQuery,
  cardListQuery,
  cardQuery,
} from "@/features/cards";
import { DesignSystemPage } from "@/features/design-system";
import { GraphPage, graphDataQuery, graphQuery } from "@/features/graphs";
import { HomeScreen } from "@/features/home";
import { MapPage, mapQuery } from "@/features/maps";
import { MediaLibraryScreen } from "@/features/media";
import { cardPropertiesQuery } from "@/features/properties";
import {
  EditStoryPage,
  type Mode,
  NewStoryPage,
  readMode,
  StoriesScreen,
  StoryIndexPage,
  storiesQuery,
  WritingSpace,
} from "@/features/quill";
import { sidebarStateQuery } from "@/features/sidebar";
import { TimelinePage, timelineQuery } from "@/features/timelines";
import { relationTypesQuery, TreePage, treeQuery } from "@/features/trees";
import {
  WikiCardPage,
  WikiHome,
  WikiLayout,
  WikiMapPage,
  WikiTimelinePage,
  wikiPagesQuery,
  wikiSettingsQuery,
} from "@/features/wiki";
import { CreateWorldDialog, currentWorldQuery, WorldListScreen } from "@/features/world";
import { useWorldHeadingFont, useWorldMaterial } from "@/features/world-theme";

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
 *   /design-system             the V2 design system (Settings › About)
 */

type RouterContext = { queryClient: QueryClient };

/**
 * A page is shown once the data it waits for is there (motion plan, batch B):
 * the router keeps the previous page on screen until these resolve, so a
 * document never shows an empty glass panel, then its title, then the rest.
 * Cached data resolves at once. A failure is left to the page, which shows it.
 * The same loaders preload a document hovered in the sidebar.
 */
async function ready(
  queryClient: QueryClient,
  // biome-ignore lint/suspicious/noExplicitAny: each query has its own data type.
  ...queries: EnsureQueryDataOptions<any, Error, any, readonly unknown[]>[]
) {
  await Promise.all(queries.map((query) => queryClient.ensureQueryData(query).catch(() => null)));
}

/**
 * The app's frame: the backdrop, the world rail (V2-2+.1) beside the page,
 * the « New world » dialog shared by the list and the rail, and the route
 * announcer. The open world's material, ornament and heading font apply to
 * all of it.
 */
function Root() {
  useWorldMaterial();
  useWorldHeadingFont();
  const createOpen = useUiStore((state) => state.createWorldOpen);
  const setCreateOpen = useUiStore((state) => state.setCreateWorldOpen);
  return (
    <>
      <Backdrop />
      <div className="relative flex h-screen w-screen">
        <WorldRail />
        <div data-slide-root className="relative min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
      <CreateWorldDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RouteAnnouncer />
    </>
  );
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Root,
});

const worldListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: WorldListScreen,
});

const designSystemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/design-system",
  component: DesignSystemPage,
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
  loader: ({ context, params }) =>
    ready(
      context.queryClient,
      cardQuery(params.cardId),
      cardContentQuery(params.cardId),
      cardPropertiesQuery(params.cardId),
      backlinksQuery(params.cardId),
      cardTypesQuery(),
      cardListQuery(false),
    ),
  component: CardPage,
});

const mapRoute = createRoute({
  getParentRoute: () => worldTabRoute,
  path: "map/$mapId",
  loader: ({ context, params }) => ready(context.queryClient, mapQuery(params.mapId)),
  component: MapPage,
});

const graphRoute = createRoute({
  getParentRoute: () => worldTabRoute,
  path: "graph/$graphId",
  loader: ({ context, params }) =>
    ready(context.queryClient, graphQuery(params.graphId), graphDataQuery(), cardTypesQuery()),
  component: GraphPage,
});

const treeRoute = createRoute({
  getParentRoute: () => worldTabRoute,
  path: "tree/$treeId",
  loader: ({ context, params }) =>
    ready(
      context.queryClient,
      treeQuery(params.treeId),
      cardListQuery(false),
      cardTypesQuery(),
      relationTypesQuery(),
    ),
  component: TreePage,
});

const canvasRoute = createRoute({
  getParentRoute: () => worldTabRoute,
  path: "canvas/$canvasId",
  loader: ({ context, params }) => ready(context.queryClient, canvasQuery(params.canvasId)),
  component: CanvasPage,
});

/** A timeline (M11); `?card=` centres it on that card's item (from « Cité dans »). */
const timelineRoute = createRoute({
  getParentRoute: () => worldTabRoute,
  path: "timeline/$timelineId",
  loader: ({ context, params }) =>
    ready(context.queryClient, timelineQuery(params.timelineId), cardListQuery(false)),
  component: TimelinePage,
  validateSearch: (search: Record<string, unknown>): { card?: string } =>
    typeof search.card === "string" && search.card !== "" ? { card: search.card } : {},
});

const wikiRoute = createRoute({
  getParentRoute: () => worldRoute,
  path: "wiki",
  loader: ({ context }) => ready(context.queryClient, wikiSettingsQuery(), wikiPagesQuery()),
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
  loader: ({ context }) => ready(context.queryClient, storiesQuery()),
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
  designSystemRoute,
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
