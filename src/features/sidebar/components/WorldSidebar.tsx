import { useParams } from "@tanstack/react-router";
import { FolderPlus, Map as MapIcon, PanelLeftClose, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { CreateCardMenu, TrashDialog } from "@/features/cards";
import { CreateMapDialog } from "@/features/maps";
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
  const { cardId, mapId } = useParams({ strict: false });
  const currentId = cardId ?? mapId ?? null;
  const [creatingMap, setCreatingMap] = useState(false);
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
    <aside aria-label={t("sidebar.label")} className="glass flex h-full flex-col rounded-lg">
      <div className="flex min-h-0 flex-1 flex-col">
        {(tree.error ?? sidebar.error) && (
          <div className="p-2">
            <AppErrorMessage error={tree.error ?? sidebar.error} />
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
              view={view}
              onViewChange={changeView}
              initialExpanded={sidebar.state.expanded ?? []}
              onExpandedChange={(expanded) => sidebar.update({ expanded })}
            />
          )}
        </SidebarSearch>
      </div>
      <div className="flex gap-1 border-t border-border p-2">
        <CreateCardMenu align="start">
          <Button variant="secondary" size="sm" className="flex-1">
            <Plus />
            {t("sidebar.newCard")}
          </Button>
        </CreateCardMenu>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("sidebar.newMap")}
          title={t("sidebar.newMap")}
          onClick={() => setCreatingMap(true)}
        >
          <MapIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
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
          aria-label={t("trash.title")}
          title={t("trash.title")}
          onClick={() => setTrashOpen(true)}
        >
          <Trash2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
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
