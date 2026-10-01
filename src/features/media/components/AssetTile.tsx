import { FileQuestion, Library, MoreHorizontal, Music, Pencil, Trash2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Asset } from "@/lib/bindings";
import { formatBytes } from "@/lib/format";
import { AssetImage } from "./AssetImage";

type AssetTileProps = {
  asset: Asset;
  onRename: () => void;
  onDelete: () => void;
  /** Offers "Add to the library" (a world's images, ADR 0006). */
  onAddToLibrary?: (() => void) | undefined;
  /** The asset is in the library shared by the worlds. */
  library?: boolean;
  /** Label of the delete action (default "Delete"). */
  deleteLabel?: string;
};

/**
 * One file of the media library: preview, name, kind and size. Actions from
 * the "…" button, a right click, or F2 / Delete on the focused "…" button.
 */
export function AssetTile({
  asset,
  onRename,
  onDelete,
  onAddToLibrary,
  library = false,
  deleteLabel,
}: AssetTileProps) {
  const { t, i18n } = useTranslation();
  const Icon = asset.kind === "audio" ? Music : FileQuestion;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "F2") {
      event.preventDefault();
      onRename();
    } else if (event.key === "Delete") {
      event.preventDefault();
      onDelete();
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <figure className="glass relative flex flex-col overflow-hidden rounded-lg">
          <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted">
            {asset.kind === "image" ? (
              <AssetImage
                assetId={asset.id}
                alt={asset.name}
                library={library}
                className="size-full object-cover"
              />
            ) : (
              <Icon aria-hidden className="size-10 text-muted-foreground" />
            )}
          </div>
          <figcaption className="flex flex-col gap-0.5 p-2 pr-10">
            <span className="truncate text-sm" title={asset.name}>
              {asset.name}
            </span>
            <span className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>{t(`media.kind.${asset.kind}`)}</span>
              <span>{formatBytes(asset.size ?? 0, i18n.language)}</span>
            </span>
          </figcaption>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label={t("media.actions", { name: asset.name })}
                aria-keyshortcuts="F2 Delete"
                onKeyDown={onKeyDown}
                className="absolute right-2 bottom-2 rounded-full"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onRename}>
                <Pencil />
                {t("media.rename")}
                <DropdownMenuShortcut>{t("media.renameKey")}</DropdownMenuShortcut>
              </DropdownMenuItem>
              {onAddToLibrary && asset.kind === "image" && (
                <DropdownMenuItem onSelect={onAddToLibrary}>
                  <Library />
                  {t("media.addToLibrary")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 />
                {deleteLabel ?? t("media.delete")}
                <DropdownMenuShortcut>{t("media.deleteKey")}</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </figure>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onRename}>
          <Pencil />
          {t("media.rename")}
          <ContextMenuShortcut>{t("media.renameKey")}</ContextMenuShortcut>
        </ContextMenuItem>
        {onAddToLibrary && asset.kind === "image" && (
          <ContextMenuItem onSelect={onAddToLibrary}>
            <Library />
            {t("media.addToLibrary")}
          </ContextMenuItem>
        )}
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          {deleteLabel ?? t("media.delete")}
          <ContextMenuShortcut>{t("media.deleteKey")}</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
