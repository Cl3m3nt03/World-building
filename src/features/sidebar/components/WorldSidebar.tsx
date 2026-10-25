import { useParams } from "@tanstack/react-router";
import {
  ChartGantt,
  FilePlus,
  FolderPlus,
  LayoutGrid,
  Map as MapIcon,
  Network,
  PanelLeftClose,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreateCanvas } from "@/features/canvases";
import { CreateCardMenu, TrashDialog } from "@/features/cards";
import { useCreateGraph } from "@/features/graphs";
import { CreateMapDialog } from "@/features/maps";
import { useCreateTimeline } from "@/features/timelines";
import { useCreateTree } from "@/features/trees";
import { useDocumentTree } from "../hooks/useDocumentTree";
import { useSidebarState } from "../hooks/useSidebarState";
import { DEFAULT_VIEW, type TreeView } from "../tree";
import { type DocumentTreeHandle, DocumentTreeView } from "./DocumentTreeView";
import { PinnedSection } from "./PinnedSection";
import { SidebarSearch } from "./SidebarSearch";
import { ViewMenu } from "./ViewMenu";

/**
 * Sidebar of the World tab (docs/features/02-organisation.md): the world's
 * folders and documents as a tree (its right click creates a card or a
 * folder), and "New card" / "New folder" / "Trash" / collapse at the bottom.
 * Its open folders, filters and sort are kept per world (ADR 0005).
 */
export function WorldSidebar({ onCollapse }: { onCollapse: () => void }) {
  const { t } = useTranslation();
  const { worldId, cardId, mapId, graphId, treeId, canvasId, timelineId } = useParams({
    strict: false,
  });
  const currentId = cardId ?? mapId ?? graphId ?? treeId ?? canvasId ?? timelineId ?? null;
  const [creatingMap, setCreatingMap] = useState(false);
  const createGraph = useCreateGraph();
  const newGraph = () => {
    if (worldId) createGraph.mutate(worldId);
  };
  const createTree = useCreateTree();
  const newTree = () => {
    if (worldId) createTree.mutate(worldId);
  };
  const createCanvas = useCreateCanvas();
  const newCanvas = () => {
    if (worldId) createCanvas.mutate(worldId);
  };
  const createTimeline = useCreateTimeline();
  const newTimeline = () => {
    if (worldId) createTimeline.mutate(worldId);
  };
  const tree = useDocumentTree();
  const [trashOpen, setTrashOpen] = useState(false);
  const treeView = useRef<DocumentTreeHandle>(null);
  const sidebar = useSidebarState();
  const savedView = sidebar.state?.view;
  const view = useMemo<TreeView>(() => ({ ...DEFAULT_VIEW, ...savedView }), [savedView]);
  const changeView = (change: Partial<TreeView> | ((latest: TreeView) => Partial<TreeView>)) =>
    sidebar.update((current) => {
      const latest = { ...DEFAULT_VIEW, ...current.view };
      return { view: { ...latest, ...(typeof change === "function" ? change(latest) : change) } };
    });

  return (
    // A container: the footer and the search adapt to the sidebar's own width.
    <aside
      aria-label={t("sidebar.label")}
      className="glass-panel @container flex h-full min-w-0 flex-col overflow-hidden rounded-lg"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {(tree.error ??
          sidebar.error ??
          createGraph.error ??
          createTree.error ??
          createCanvas.error ??
          createTimeline.error) && (
          <div className="p-2">
            <AppErrorMessage
              error={
                tree.error ??
                sidebar.error ??
                createGraph.error ??
                createTree.error ??
                createCanvas.error ??
                createTimeline.error
              }
            />
          </div>
        )}
        <SidebarSearch actions={<ViewMenu view={view} onChange={changeView} />}>
          {tree.data && <PinnedSection tree={tree.data} currentId={currentId} />}
          {tree.data && sidebar.state && (
            <DocumentTreeView
              ref={treeView}
              tree={tree.data}
              currentId={currentId}
              onNewMap={() => setCreatingMap(true)}
              onNewGraph={newGraph}
              onNewTree={newTree}
              onNewCanvas={newCanvas}
              onNewTimeline={newTimeline}
              view={view}
              onViewChange={changeView}
              initialExpanded={sidebar.state.expanded ?? []}
              onExpandedChange={(expanded) => sidebar.update({ expanded })}
            />
          )}
        </SidebarSearch>
      </div>
      <div className="flex min-w-0 items-center gap-1 border-t border-border p-2">
        <CreateCardMenu align="start">
          {/* Narrow sidebar: the icon alone, the name kept for screen readers. */}
          <Button
            variant="secondary"
            size="sm"
            className="min-w-0 flex-1"
            title={t("sidebar.newCard")}
          >
            <Plus />
            <span className="sr-only truncate @[15rem]:not-sr-only">{t("sidebar.newCard")}</span>
          </Button>
        </CreateCardMenu>
        {/* Maps, graphs, trees, canvases and timelines: one menu, so the bar does not grow. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label={t("sidebar.newDocument")}
              title={t("sidebar.newDocument")}
            >
              <FilePlus />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            <DropdownMenuItem onSelect={() => setCreatingMap(true)}>
              <MapIcon />
              {t("sidebar.newMap")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={createGraph.isPending} onSelect={newGraph}>
              <Share2 />
              {t("sidebar.newGraph")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={createTree.isPending} onSelect={newTree}>
              <Network />
              {t("sidebar.newTree")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={createCanvas.isPending} onSelect={newCanvas}>
              <LayoutGrid />
              {t("sidebar.newCanvas")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={createTimeline.isPending} onSelect={newTimeline}>
              <ChartGantt />
              {t("sidebar.newTimeline")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={t("sidebar.folder.new")}
          title={t("sidebar.folder.new")}
          disabled={!tree.data}
          onClick={() => treeView.current?.newFolder()}
        >
          <FolderPlus />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={t("trash.title")}
          title={t("trash.title")}
          onClick={() => setTrashOpen(true)}
        >
          <Trash2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={t("sidebar.collapse")}
          title={t("sidebar.collapse")}
          onClick={onCollapse}
        >
          <PanelLeftClose />
        </Button>
      </div>
      <TrashDialog open={trashOpen} onOpenChange={setTrashOpen} />
      <CreateMapDialog open={creatingMap} onOpenChange={setCreatingMap} />
    </aside>
  );
}
