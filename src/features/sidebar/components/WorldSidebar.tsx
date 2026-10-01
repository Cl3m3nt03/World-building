import { useParams } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { CreateCardContextMenu, CreateCardMenu, TrashDialog } from "@/features/cards";
import { useDocumentTree } from "../hooks/useDocumentTree";
import { DocumentTreeView } from "./DocumentTreeView";

/**
 * Sidebar of the World tab (docs/features/02-organisation.md): the world's
 * folders and documents as a tree, a right click anywhere to create a card,
 * and "New card" / "Trash" at the bottom.
 */
export function WorldSidebar() {
  const { t } = useTranslation();
  const { cardId } = useParams({ strict: false });
  const tree = useDocumentTree();
  const [trashOpen, setTrashOpen] = useState(false);
  const isEmpty = tree.data?.documents.length === 0 && tree.data.folders.length === 0;

  return (
    <aside aria-label={t("sidebar.label")} className="glass flex h-full flex-col rounded-lg">
      <CreateCardContextMenu>
        <div className="flex min-h-0 flex-1 flex-col">
          {tree.error && (
            <div className="p-2">
              <AppErrorMessage error={tree.error} />
            </div>
          )}
          {isEmpty ? (
            <p className="p-4 text-center text-xs text-muted-foreground">{t("sidebar.empty")}</p>
          ) : (
            tree.data && <DocumentTreeView tree={tree.data} currentId={cardId ?? null} />
          )}
        </div>
      </CreateCardContextMenu>
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
