import { ImageUp, Search, Upload } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { openDialog as pickFiles } from "@/lib/dialogs";
import { cn } from "@/lib/utils";
import { useAssets } from "../hooks/useAssets";
import { useImportAsset } from "../hooks/useImportAsset";
import { AssetImage } from "./AssetImage";

/** Extensions offered by the import dialog (the Rust side detects the kind). */
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"];

type ImagePickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the id of the chosen or imported image; the dialog then closes. */
  onPick: (assetId: string) => void;
  /** Image selected when the dialog opens (the current value). */
  selectedId?: string | null;
  title?: string;
};

/** Number of columns of a CSS grid, from the positions of its items. */
function columnCount(items: HTMLElement[]): number {
  const top = items[0]?.offsetTop;
  const sameRow = items.findIndex((item) => item.offsetTop !== top);
  return sameRow === -1 ? Math.max(items.length, 1) : sameRow;
}

/**
 * Reusable image picker: choose an image of the media library (search,
 * preview, arrow keys and Enter) or import a new one from the PC.
 */
export function ImagePickerDialog({
  open,
  onOpenChange,
  onPick,
  selectedId = null,
  title,
}: ImagePickerDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(selectedId);
  const listRef = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const images = useAssets({ kind: "image", search: search.trim() || null });
  const importFile = useImportAsset();
  const list = images.data ?? [];

  useEffect(() => {
    if (open) {
      setSelected(selectedId);
      setSearch("");
      importFile.reset();
    }
  }, [open, selectedId, importFile.reset]);

  const pick = (id: string) => {
    onPick(id);
    onOpenChange(false);
  };

  const importImage = async () => {
    const path = await pickFiles({
      multiple: false,
      title: t("imagePicker.importTitle"),
      filters: [{ name: t("media.filter.image"), extensions: IMAGE_EXTENSIONS }],
    });
    if (typeof path !== "string") return;
    importFile.mutate(path, {
      onSuccess: ({ asset }) => {
        if (asset.kind === "image") pick(asset.id);
      },
    });
  };

  /** Arrow keys move the selection in the grid, Enter confirms it. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (list.length === 0) return;
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[role=option]") ?? []);
    const current = Math.max(
      list.findIndex((asset) => asset.id === selected),
      0,
    );
    const columns = columnCount(items);
    const moves: Record<string, number> = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      ArrowUp: current - columns,
      ArrowDown: current + columns,
      Home: 0,
      End: list.length - 1,
    };
    if (event.key === "Enter" && selected) {
      event.preventDefault();
      pick(selected);
      return;
    }
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const index = Math.min(Math.max(next, 0), list.length - 1);
    const asset = list[index];
    if (!asset) return;
    setSelected(asset.id);
    items[index]?.focus();
  };

  const focusable = list.some((asset) => asset.id === selected) ? selected : list[0]?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title ?? t("imagePicker.title")}</DialogTitle>
          <DialogDescription>{t("imagePicker.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-48 flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={searchId}
              type="search"
              aria-label={t("media.search")}
              placeholder={t("media.search")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-8"
            />
          </div>
          <Button variant="secondary" onClick={importImage} disabled={importFile.isPending}>
            <Upload />
            {t("imagePicker.import")}
          </Button>
        </div>

        {(importFile.error ?? images.error) && (
          <AppErrorMessage error={importFile.error ?? images.error} />
        )}
        {importFile.isSuccess && importFile.data.asset.kind !== "image" && (
          <p role="alert" className="text-sm text-destructive">
            {t("imagePicker.notAnImage")}
          </p>
        )}

        {images.data && list.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
            <ImageUp aria-hidden className="size-10 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              {search ? t("media.noMatch") : t("imagePicker.empty")}
            </p>
          </div>
        ) : (
          <div
            ref={listRef}
            role="listbox"
            aria-label={t("imagePicker.listLabel")}
            className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3 overflow-y-auto p-1"
          >
            {list.map((asset) => (
              <div
                key={asset.id}
                role="option"
                aria-selected={asset.id === selected}
                tabIndex={asset.id === focusable ? 0 : -1}
                onClick={() => setSelected(asset.id)}
                onDoubleClick={() => pick(asset.id)}
                onKeyDown={onKeyDown}
                className={cn(
                  "glass flex cursor-pointer flex-col overflow-hidden rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  asset.id === selected && "ring-2 ring-primary",
                )}
              >
                <div className="aspect-square overflow-hidden bg-muted">
                  <AssetImage assetId={asset.id} alt="" className="size-full object-cover" />
                </div>
                <span className="truncate p-2 text-xs" title={asset.name}>
                  {asset.name}
                </span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("createWorld.cancel")}
          </Button>
          <Button disabled={!selected} onClick={() => selected && pick(selected)}>
            {t("imagePicker.choose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
