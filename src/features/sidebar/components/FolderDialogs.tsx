import { Folder as FolderIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChoiceTiles, TYPE_ICON_NAMES, typeIcon } from "@/features/card-types";
import type { Folder } from "@/lib/bindings";
import { useDeleteFolder, useUpdateFolder } from "../hooks/useDocumentTree";
import type { TreeNode } from "../tree";

/** Icons a folder can take: the plain folder, then the card types' library. */
const FOLDER_ICONS = ["folder", ...TYPE_ICON_NAMES];

export function folderIcon(name: string) {
  return name === "folder" ? FolderIcon : typeIcon(name);
}

type IconDialogProps = { folder: Folder | null; onClose: () => void };

/** Picks the icon of a folder; each choice is saved at once. */
export function FolderIconDialog({ folder, onClose }: IconDialogProps) {
  const { t } = useTranslation();
  const update = useUpdateFolder();
  return (
    <Dialog open={folder !== null} onOpenChange={(open) => !open && onClose()}>
      {folder && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("sidebar.folder.iconTitle", { name: folder.name })}</DialogTitle>
            <DialogDescription>{t("sidebar.folder.iconDescription")}</DialogDescription>
          </DialogHeader>
          {update.error && <AppErrorMessage error={update.error} />}
          <ChoiceTiles
            label={t("sidebar.folder.icons")}
            value={folder.icon}
            onChange={(icon) => update.mutate({ id: folder.id, patch: { icon } })}
            className="grid grid-cols-8 gap-1"
            tileClassName="size-9"
            choices={FOLDER_ICONS.map((name) => {
              const Icon = folderIcon(name);
              return { value: name, label: name, content: <Icon aria-hidden className="size-4" /> };
            })}
          />
          <DialogFooter>
            <Button onClick={onClose}>{t("sidebar.folder.done")}</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

type DeleteDialogProps = {
  /** The folder's node in the tree, with its content. */
  node: (TreeNode & { kind: "folder" }) | null;
  onClose: () => void;
};

/** Number of documents inside a node, at every depth. */
function documentsIn(node: TreeNode): number {
  return node.children.reduce(
    (count, child) => count + (child.kind === "document" ? 1 : 0) + documentsIn(child),
    0,
  );
}

/**
 * Deletes a folder. An empty one is just confirmed; otherwise its content
 * either takes its place ("lift") or goes to the trash ("trash").
 */
export function DeleteFolderDialog({ node, onClose }: DeleteDialogProps) {
  const { t } = useTranslation();
  const remove = useDeleteFolder();
  const close = () => {
    remove.reset();
    onClose();
  };
  const run = (mode: "lift" | "trash") =>
    remove.mutate({ id: node?.folder.id ?? "", mode }, { onSuccess: close });
  const items = node?.children.length ?? 0;
  const documents = node ? documentsIn(node) : 0;

  return (
    <Dialog open={node !== null} onOpenChange={(open) => !open && close()}>
      {node && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("sidebar.folder.deleteTitle", { name: node.folder.name })}</DialogTitle>
            <DialogDescription>
              {items === 0
                ? t("sidebar.folder.deleteEmpty")
                : t("sidebar.folder.deleteWhat", { count: items })}
            </DialogDescription>
          </DialogHeader>
          {remove.error && <AppErrorMessage error={remove.error} />}
          {items > 0 && (
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li>
                <strong className="block font-medium text-foreground">
                  {t("sidebar.folder.deleteLift")}
                </strong>
                {t("sidebar.folder.deleteLiftHint")}
              </li>
              <li>
                <strong className="block font-medium text-foreground">
                  {t("sidebar.folder.deleteTrash")}
                </strong>
                {t("sidebar.folder.deleteTrashHint", { count: documents })}
              </li>
            </ul>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={close}>
              {t("sidebar.folder.cancel")}
            </Button>
            {items === 0 ? (
              <Button variant="destructive" disabled={remove.isPending} onClick={() => run("lift")}>
                {t("sidebar.folder.deleteConfirm")}
              </Button>
            ) : (
              <>
                <Button
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() => run("trash")}
                >
                  {t("sidebar.folder.deleteTrash")}
                </Button>
                <Button disabled={remove.isPending} onClick={() => run("lift")}>
                  {t("sidebar.folder.deleteLift")}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
