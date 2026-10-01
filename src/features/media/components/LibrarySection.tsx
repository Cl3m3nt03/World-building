import { Library, Upload } from "lucide-react";
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
import type { Asset } from "@/lib/bindings";
import { openDialog as pickFiles } from "@/lib/dialogs";
import { formatBytes } from "@/lib/format";
import {
  useImportLibraryAsset,
  useLibraryAssets,
  useRemoveLibraryAsset,
} from "../hooks/useLibrary";
import { useLibraryStorage } from "../hooks/useStorage";
import { RenameAssetDialog } from "./AssetDialogs";
import { AssetTile } from "./AssetTile";

/** Extensions offered by the import dialog (the library holds images). */
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"];

/**
 * The library shared by the worlds (ADR 0006), in the app settings: its
 * images with their total size, import from the PC, rename and remove. The
 * worlds keep the copies they took.
 */
export function LibrarySection({ enabled }: { enabled: boolean }) {
  const { t, i18n } = useTranslation();
  const assets = useLibraryAssets({ kind: null, search: null }, enabled);
  const importFile = useImportLibraryAsset();
  const storage = useLibraryStorage(enabled);
  const [renaming, setRenaming] = useState<Asset | null>(null);
  const [removing, setRemoving] = useState<Asset | null>(null);
  const list = assets.data ?? [];
  const total = list.reduce((sum, asset) => sum + (asset.size ?? 0), 0);

  const chooseFiles = async () => {
    const picked = await pickFiles({
      multiple: true,
      title: t("library.importTitle"),
      filters: [{ name: t("media.filter.image"), extensions: IMAGE_EXTENSIONS }],
    });
    const paths = typeof picked === "string" ? [picked] : (picked ?? []);
    for (const path of paths) importFile.mutate(path);
  };

  return (
    <>
      <p className="text-xs text-muted-foreground">{t("library.hint")}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-col text-sm text-muted-foreground">
          <span>
            {t("library.summary", {
              count: list.length,
              size: formatBytes(total, i18n.language),
            })}
          </span>
          {typeof storage.data?.available === "number" && (
            <span className="text-xs">
              {t("library.available", {
                available: formatBytes(storage.data.available, i18n.language),
              })}
            </span>
          )}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={chooseFiles}
          disabled={importFile.isPending}
        >
          <Upload />
          {t("library.import")}
        </Button>
      </div>
      {(importFile.error ?? assets.error) && (
        <AppErrorMessage error={importFile.error ?? assets.error} />
      )}
      {assets.data && list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center text-sm text-muted-foreground">
          <Library aria-hidden className="size-8" />
          {t("library.empty")}
        </div>
      ) : (
        <ul
          aria-label={t("library.title")}
          className="grid max-h-80 grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2 overflow-y-auto p-1"
        >
          {list.map((asset) => (
            <li key={asset.id}>
              <AssetTile
                asset={asset}
                library
                deleteLabel={t("library.remove")}
                onRename={() => setRenaming(asset)}
                onDelete={() => setRemoving(asset)}
              />
            </li>
          ))}
        </ul>
      )}
      <RenameAssetDialog library asset={renaming} onClose={() => setRenaming(null)} />
      <RemoveFromLibraryDialog asset={removing} onClose={() => setRemoving(null)} />
    </>
  );
}

function RemoveFromLibraryDialog({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const { t } = useTranslation();
  const remove = useRemoveLibraryAsset();
  return (
    <Dialog
      open={asset !== null}
      onOpenChange={(open) => {
        if (!open) {
          remove.reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("library.removeTitle", { name: asset?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("library.removeDescription")}</DialogDescription>
        </DialogHeader>
        {remove.error && <AppErrorMessage error={remove.error} />}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("createWorld.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => asset && remove.mutate(asset.id, { onSuccess: onClose })}
          >
            {t("library.remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
