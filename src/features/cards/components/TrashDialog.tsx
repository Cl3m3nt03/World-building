import {
  ChartGantt,
  LayoutGrid,
  Map as MapIcon,
  Network,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import {
  useCardList,
  useDeleteDocumentForever,
  useEmptyTrash,
  useRestoreDocument,
  useTrashedMaps,
} from "../hooks/useCards";

type TrashDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * The world's trash: restore a card or a map, delete it for good, or empty it
 * all. Both deletions for good ask for a confirmation first.
 */
export function TrashDialog({ open, onOpenChange }: TrashDialogProps) {
  const { t } = useTranslation();
  const trashed = useCardList(true);
  const trashedMaps = useTrashedMaps();
  const types = useCardTypes();
  const restore = useRestoreDocument();
  const remove = useDeleteDocumentForever();
  const empty = useEmptyTrash();
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  // The item whose "Delete for good" waits for a confirmation (#604), and the
  // one whose delete button gets the focus back once it is cancelled.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [refocus, setRefocus] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const focusOnMount = useCallback((element: HTMLElement | null) => element?.focus(), []);
  useEffect(() => {
    if (refocus === null) return;
    list.current
      ?.querySelector<HTMLElement>(`[data-delete-for-good="${CSS.escape(refocus)}"]`)
      ?.focus();
    setRefocus(null);
  }, [refocus]);
  // Cards, maps, graphs and trees, by title.
  const items = [
    ...(trashed.data ?? []).map((card) => ({
      id: card.id,
      title: card.title,
      typeId: card.typeId,
      kind: "card",
    })),
    ...(trashedMaps.data ?? []).map((document) => ({
      id: document.id,
      title: document.title,
      typeId: null,
      kind: document.kind,
    })),
  ].sort((a, b) => a.title.localeCompare(b.title));
  const error = restore.error ?? remove.error ?? empty.error ?? trashed.error ?? trashedMaps.error;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setConfirmEmpty(false);
          setConfirmDelete(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("trash.title")}</DialogTitle>
          <DialogDescription>{t("trash.description")}</DialogDescription>
        </DialogHeader>

        {error && <AppErrorMessage error={error} />}

        {trashed.data && trashedMaps.data && items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("trash.empty")}</p>
        ) : (
          <ul
            ref={list}
            aria-label={t("trash.title")}
            className="flex max-h-80 flex-col gap-1 overflow-y-auto"
          >
            {items.map((item) => {
              const type = types.data?.find((candidate) => candidate.id === item.typeId);
              const Icon =
                item.kind === "map"
                  ? MapIcon
                  : item.kind === "graph"
                    ? Share2
                    : item.kind === "tree"
                      ? Network
                      : item.kind === "canvas"
                        ? LayoutGrid
                        : item.kind === "timeline"
                          ? ChartGantt
                          : typeIcon(type?.icon ?? "shapes");
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent"
                >
                  <Icon
                    aria-hidden
                    className="size-4 shrink-0"
                    style={{ color: typeColor(type?.color ?? "slate") }}
                  />
                  {confirmDelete === item.id ? (
                    <>
                      <p
                        role="alert"
                        className="min-w-0 flex-1 text-sm break-words text-destructive"
                      >
                        {t("trash.deleteConfirm", { name: item.title })}
                      </p>
                      {/* The safe choice takes the focus: Enter keeps the item. */}
                      <Button
                        ref={focusOnMount}
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setConfirmDelete(null);
                          setRefocus(item.id);
                        }}
                      >
                        {t("createWorld.cancel")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={remove.isPending}
                        onClick={() =>
                          remove.mutate(item.id, { onSuccess: () => setConfirmDelete(null) })
                        }
                      >
                        {t("trash.deleteConfirmAction")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t("trash.restoreNamed", { name: item.title })}
                        disabled={restore.isPending}
                        onClick={() => restore.mutate(item.id)}
                      >
                        <RotateCcw />
                        {t("trash.restore")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("trash.deleteNamed", { name: item.title })}
                        title={t("trash.delete")}
                        data-delete-for-good={item.id}
                        onClick={() => setConfirmDelete(item.id)}
                        className="text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter className="items-center">
          {confirmEmpty ? (
            <>
              <p role="alert" className="mr-auto text-sm text-destructive">
                {t("trash.emptyConfirm", { count: items.length })}
              </p>
              <Button variant="ghost" onClick={() => setConfirmEmpty(false)}>
                {t("createWorld.cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={empty.isPending}
                onClick={() => empty.mutate(undefined, { onSuccess: () => setConfirmEmpty(false) })}
              >
                {t("trash.emptyForGood")}
              </Button>
            </>
          ) : (
            <Button
              variant="destructive"
              disabled={items.length === 0}
              onClick={() => setConfirmEmpty(true)}
            >
              <Trash2 />
              {t("trash.emptyAction")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
