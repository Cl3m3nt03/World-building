import { Outlet, useParams } from "@tanstack/react-router";
import {
  ChartGantt,
  LayoutGrid,
  Map as MapIcon,
  Network,
  PanelLeftOpen,
  Share2,
  SquareUser,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { SIDEBAR_WIDTH } from "@/app/stores/ui";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useCreateCanvas } from "@/features/canvases";
import { CreateCardMenu } from "@/features/cards";
import { useCreateGraph } from "@/features/graphs";
import { CreateMapDialog } from "@/features/maps";
import { useSidebarState, WorldSidebar } from "@/features/sidebar";
import { useCreateTimeline } from "@/features/timelines";
import { useCreateTree } from "@/features/trees";
import { usePageTransition } from "./navigation";
import { slideLayout } from "./useSlideCollapse";

/**
 * Keeps the leaving sidebar where it is while its panel is already closed:
 * its own width, its panel no longer cutting it (the group still does).
 */
function pinSidebar(aside: HTMLElement, from: DOMRect) {
  const inner = aside.closest("[data-panel]")?.firstElementChild;
  const box = inner instanceof HTMLElement ? inner : null;
  const width = aside.style.width;
  const overflow = box?.style.overflow ?? "";
  aside.style.width = `${from.width}px`;
  if (box) box.style.overflow = "visible";
  return () => {
    aside.style.width = width;
    if (box) box.style.overflow = overflow;
  };
}

const TILE_CLASS = "glass size-12 rounded-lg [&_svg:not([class*='size-'])]:size-5";

/**
 * Empty-workspace prompt: "Start with…" and one tile per document kind.
 * A card is created from its type menu; kinds whose module does not exist
 * yet stay visible but are marked unavailable, so nothing clickable
 * silently does nothing.
 */
export function StartWith() {
  const { t } = useTranslation();
  const [creatingMap, setCreatingMap] = useState(false);
  const { worldId } = useParams({ strict: false });
  const createGraph = useCreateGraph();
  const createTree = useCreateTree();
  const createCanvas = useCreateCanvas();
  const createTimeline = useCreateTimeline();
  const createError =
    createGraph.error ?? createTree.error ?? createCanvas.error ?? createTimeline.error;
  return (
    <div className="on-backdrop flex h-full flex-col items-center justify-center gap-3">
      {createError && <AppErrorMessage error={createError} />}
      <p className="text-sm text-muted-foreground">{t("workspace.startWith")}</p>
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <CreateCardMenu>
            <Button
              variant="secondary"
              aria-label={t("workspace.create.card")}
              className={TILE_CLASS}
            >
              <SquareUser />
            </Button>
          </CreateCardMenu>
          <span className="text-xs text-muted-foreground">{t("workspace.create.card")}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Button
            variant="secondary"
            aria-label={t("workspace.create.map")}
            className={TILE_CLASS}
            onClick={() => setCreatingMap(true)}
          >
            <MapIcon />
          </Button>
          <span className="text-xs text-muted-foreground">{t("workspace.create.map")}</span>
          <CreateMapDialog open={creatingMap} onOpenChange={setCreatingMap} />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Button
            variant="secondary"
            aria-label={t("workspace.create.graph")}
            className={TILE_CLASS}
            disabled={createGraph.isPending}
            onClick={() => worldId && createGraph.mutate(worldId)}
          >
            <Share2 />
          </Button>
          <span className="text-xs text-muted-foreground">{t("workspace.create.graph")}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Button
            variant="secondary"
            aria-label={t("workspace.create.tree")}
            className={TILE_CLASS}
            disabled={createTree.isPending}
            onClick={() => worldId && createTree.mutate(worldId)}
          >
            <Network />
          </Button>
          <span className="text-xs text-muted-foreground">{t("workspace.create.tree")}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Button
            variant="secondary"
            aria-label={t("workspace.create.canvas")}
            className={TILE_CLASS}
            disabled={createCanvas.isPending}
            onClick={() => worldId && createCanvas.mutate(worldId)}
          >
            <LayoutGrid />
          </Button>
          <span className="text-xs text-muted-foreground">{t("workspace.create.canvas")}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Button
            variant="secondary"
            aria-label={t("workspace.create.timeline")}
            className={TILE_CLASS}
            disabled={createTimeline.isPending}
            onClick={() => worldId && createTimeline.mutate(worldId)}
          >
            <ChartGantt />
          </Button>
          <span className="text-xs text-muted-foreground">{t("workspace.create.timeline")}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * World tab: resizable sidebar + central workspace. The sidebar's width and
 * collapse are kept per world (ADR 0005); collapsed, a button at the top
 * left of the workspace brings it back. The handle takes the focus and is
 * moved with the arrow keys.
 */
export function WorldWorkspace() {
  const { t } = useTranslation();
  // Another document: its content enters, the glass panel stays.
  const { worldId, cardId, mapId, graphId, treeId, canvasId, timelineId } = useParams({
    strict: false,
  });
  const page = useRef<HTMLElement>(null);
  usePageTransition(page, cardId ?? mapId ?? graphId ?? treeId ?? canvasId ?? timelineId ?? null, {
    target: "panel",
  });
  const sidebar = useSidebarState();
  const panel = useRef<PanelImperativeHandle>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const group = useRef<HTMLDivElement>(null);
  // Collapsing or expanding with a button moves the focus to what is now
  // there (the button that undoes it, or the sidebar's search field).
  const moveFocus = useRef(false);
  // The sidebar's size when this world opened. It must not follow the saved
  // width: a new `defaultSize` registers the panel again, which ends a drag.
  const opening = useRef<{ worldId: string | undefined; size: number } | null>(null);
  const state = sidebar.state;
  const collapsed = state?.collapsed ?? false;
  // The sidebar slides in or out (motion plan, batch D): it stays mounted
  // until its slide is over.
  const [sliding, setSliding] = useState<"in" | "out" | null>(null);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    if (collapsed) expandButton.current?.focus();
    else group.current?.querySelector<HTMLElement>("aside [role=combobox]")?.focus();
  }, [collapsed]);
  if (sidebar.error) return <AppErrorMessage error={sidebar.error} />;
  if (!state) return null;
  const width = state.width ?? SIDEBAR_WIDTH.default;
  const previous = opening.current;
  const openingSize =
    previous && previous.worldId === worldId ? previous.size : collapsed ? 0 : width;
  opening.current = { worldId, size: openingSize };

  // Collapsing or expanding by a button: the new width is set at once, so the
  // page is laid out once, and the panels slide to it.
  const slideSidebar = (open: boolean) => {
    moveFocus.current = true;
    const change = () => {
      setSliding(open ? "in" : "out");
      if (open) panel.current?.expand();
      else panel.current?.collapse();
    };
    const main = page.current;
    if (!main) {
      change();
      setSliding(null);
      return;
    }
    const aside = () => group.current?.querySelector<HTMLElement>("aside") ?? null;
    const current = aside();
    slideLayout({
      root: main,
      change,
      leaving: !open && current ? { element: current, pin: pinSidebar } : undefined,
      entering: open ? aside : undefined,
      distance: -(current?.getBoundingClientRect().width || width),
      unclip: "[data-panel] > *",
      done: () => setSliding(null),
    });
  };

  return (
    <ResizablePanelGroup
      key={worldId}
      elementRef={group}
      orientation="horizontal"
      className="gap-1"
    >
      <ResizablePanel
        panelRef={panel}
        defaultSize={openingSize}
        minSize={SIDEBAR_WIDTH.min}
        maxSize={SIDEBAR_WIDTH.max}
        collapsible
        collapsedSize={0}
        // The window's size is not the user's choice of width (`onResize` saves it).
        groupResizeBehavior="preserve-pixel-size"
        onResize={(size) => {
          const nowCollapsed = size.inPixels < 1;
          const nowWidth = Math.round(size.inPixels);
          if (nowCollapsed !== collapsed || (!nowCollapsed && nowWidth !== width)) {
            sidebar.update(
              nowCollapsed ? { collapsed: true } : { collapsed: false, width: nowWidth },
            );
          }
        }}
      >
        {(!collapsed || sliding !== null) && (
          <WorldSidebar onCollapse={() => slideSidebar(false)} />
        )}
      </ResizablePanel>
      <ResizableHandle
        aria-label={t("sidebar.resize")}
        className="w-1 rounded-full bg-transparent hover:bg-border-strong focus-visible:bg-primary"
      />
      <ResizablePanel>
        <main ref={page} className="relative h-full">
          {collapsed && (
            <Button
              ref={expandButton}
              variant="secondary"
              size="icon-sm"
              aria-label={t("sidebar.expand")}
              title={t("sidebar.expand")}
              onClick={() => slideSidebar(true)}
              className="glass absolute top-2 left-2 z-10 animate-in fade-in-0 duration-(--bz-duration-base) ease-(--bz-ease-out)"
            >
              <PanelLeftOpen />
            </Button>
          )}
          <Outlet />
        </main>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
