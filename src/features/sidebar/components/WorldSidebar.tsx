import { useParams } from "@tanstack/react-router";
import { FolderPlus, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { CreateCardMenu, TrashDialog } from "@/features/cards";
import { useDocumentTree } from "../hooks/useDocumentTree";
import { DEFAULT_VIEW, type TreeView } from "../tree";
import { type DocumentTreeHandle, DocumentTreeView } from "./DocumentTreeView";
import { PinnedSection } from "./PinnedSection";
import { SidebarSearch } from "./SidebarSearch";
import { ViewMenu } from "./ViewMenu";

/**
 * Sidebar of the World tab (docs/features/02-organisation.md): the world's
 * folders and documents as a tree (its right click creates a card or a
 * folder), and "New card" / "New folder" / "Trash" at the bottom.
 */
export function WorldSidebar() {
  const { t } = useTranslation();
  const { cardId } = useParams({ strict: false });
  const tree = useDocumentTree();
  const [trashOpen, setTrashOpen] = useState(false);
  const treeView = useRef<DocumentTreeHandle>(null);
  // Filters and sort; kept per world in step 3.9.
  const [view, setView] = useState<TreeView>(DEFAULT_VIEW);

  return (
    <aside aria-label={t("sidebar.label")} className="glass flex h-full flex-col rounded-lg">
      <div className="flex min-h-0 flex-1 flex-col">
        {tree.error && (
          <div className="p-2">
            <AppErrorMessage error={tree.error} />
          </div>
        )}
        <SidebarSearch actions={<ViewMenu view={view} onChange={setView} />}>
          {tree.data && <PinnedSection tree={tree.data} currentId={cardId ?? null} />}
          {tree.data && (
            <DocumentTreeView
              ref={treeView}
              tree={tree.data}
              currentId={cardId ?? null}
              view={view}
              onViewChange={setView}
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
      </div>
      <TrashDialog open={trashOpen} onOpenChange={setTrashOpen} />
    </aside>
  );
}
