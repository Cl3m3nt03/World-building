import { ImageUp, Search, Upload } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TranslationKey } from "@/i18n";
import type { Asset, AssetKind } from "@/lib/bindings";
import { openDialog as pickFiles } from "@/lib/dialogs";
import { cn } from "@/lib/utils";
import { useAssets } from "../hooks/useAssets";
import { useFileDrop } from "../hooks/useFileDrop";
import { useImportAsset, useImportAssetData } from "../hooks/useImportAsset";
import { type PastedImage, usePastedImages } from "../hooks/usePastedImages";
import { DeleteAssetDialog, RenameAssetDialog } from "./AssetDialogs";
import { AssetTile } from "./AssetTile";

const KINDS: { value: AssetKind | null; label: TranslationKey }[] = [
  { value: null, label: "media.filter.all" },
  { value: "image", label: "media.filter.image" },
  { value: "audio", label: "media.filter.audio" },
  { value: "other", label: "media.filter.other" },
];

/**
 * Media library of the open world: every imported file, with import by
 * button, drag and drop on the window, or paste (Ctrl+V).
 */
export function MediaLibraryScreen() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<AssetKind | null>(null);
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState<Asset | null>(null);
  const searchId = useId();
  const assets = useAssets({ kind, search: search.trim() || null });
  const importFile = useImportAsset();
  const importData = useImportAssetData();

  const importPaths = useCallback(
    (paths: string[]) => {
      for (const path of paths) importFile.mutate(path);
    },
    [importFile.mutate],
  );
  const hovering = useFileDrop(importPaths);

  const importPasted = useCallback(
    ({ extension, data }: PastedImage) => {
      const stamp = new Date().toISOString().slice(0, 19).replace("T", " ").replaceAll(":", "-");
      importData.mutate({ name: `${t("media.pastedName")} ${stamp}.${extension}`, data });
    },
    [importData.mutate, t],
  );
  usePastedImages(importPasted);

  const chooseFiles = async () => {
    const picked = await pickFiles({ multiple: true, title: t("media.importPickerTitle") });
    if (Array.isArray(picked)) importPaths(picked);
    else if (typeof picked === "string") importPaths([picked]);
  };

  const error = importFile.error ?? importData.error ?? assets.error;
  const busy = importFile.isPending || importData.isPending;

  return (
    <main className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 px-8 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">{t("media.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("media.description")}</p>
        </div>
        <Button onClick={chooseFiles} disabled={busy}>
          <Upload />
          {t("media.import")}
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <fieldset className="glass flex rounded-full border-0 p-1">
          <legend className="sr-only">{t("media.filter.label")}</legend>
          {KINDS.map(({ value, label }) => (
            <button
              key={label}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={cn(
                "rounded-full px-3 py-1 text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                kind === value && "bg-secondary text-foreground",
              )}
            >
              {t(label)}
            </button>
          ))}
        </fieldset>
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
      </div>

      {error && <AppErrorMessage error={error} />}
      {busy && <p className="text-sm text-muted-foreground">{t("media.importing")}</p>}

      <section
        aria-label={t("media.title")}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto rounded-lg pb-8 transition-colors",
          hovering && "bg-primary/10 ring-2 ring-primary",
        )}
      >
        {assets.data && assets.data.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <ImageUp aria-hidden className="size-10 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              {search || kind ? t("media.noMatch") : t("media.empty")}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
            {assets.data?.map((asset) => (
              <li key={asset.id}>
                <AssetTile
                  asset={asset}
                  onRename={() => setRenaming(asset)}
                  onDelete={() => setDeleting(asset)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <RenameAssetDialog asset={renaming} onClose={() => setRenaming(null)} />
      <DeleteAssetDialog asset={deleting} onClose={() => setDeleting(null)} />
    </main>
  );
}
