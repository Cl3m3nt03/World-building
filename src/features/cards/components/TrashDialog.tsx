import { Map as MapIcon, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
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

/** The world's trash: restore a card or a map, delete it for good, or empty it all. */
export function TrashDialog({ open, onOpenChange }: TrashDialogProps) {
  const { t } = useTranslation();
  const trashed = useCardList(true);
  const trashedMaps = useTrashedMaps();
  const types = useCardTypes();
  const restore = useRestoreDocument();
  const remove = useDeleteDocumentForever();
  const empty = useEmptyTrash();
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  // Cards and maps, by title.
  const items = [
    ...(trashed.data ?? []).map((card) => ({
      id: card.id,
      title: card.title,
      typeId: card.typeId,
    })),
    ...(trashedMaps.data ?? []).map((map) => ({ id: map.id, title: map.title, typeId: null })),
  ].sort((a, b) => a.title.localeCompare(b.title));
  const error = restore.error ?? remove.error ?? empty.error ?? trashed.error ?? trashedMaps.error;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmEmpty(false);
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
            aria-label={t("trash.title")}
            className="flex max-h-80 flex-col gap-1 overflow-y-auto"
          >
            {items.map((item) => {
              const type = types.data?.find((candidate) => candidate.id === item.typeId);
              const Icon = item.typeId === null ? MapIcon : typeIcon(type?.icon ?? "shapes");
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
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(item.id)}
                    className="text-destructive"
                  >
                    <Trash2 />
                  </Button>
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
