import { FolderOpen, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssetImage, ImagePickerDialog } from "@/features/media";
import {
  GENRES,
  isGenre,
  useRevealWorld,
  useSetWorldMainImage,
  useUpdateWorld,
} from "@/features/world";
import type { WorldInfo, WorldPatch } from "@/lib/bindings";

/** Delay before a typed change is saved. */
const SAVE_DELAY_MS = 500;

/**
 * "General" section of the world settings: main image (through the image
 * picker), name, genre and description, saved as they are edited, and the
 * world folder.
 */
export function GeneralSection({ world }: { world: WorldInfo }) {
  const { t } = useTranslation();
  const update = useUpdateWorld();
  const setMainImage = useSetWorldMainImage();
  const reveal = useRevealWorld();
  const [name, setName] = useState(world.name);
  const [description, setDescription] = useState(world.description);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pending = useRef<WorldPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nameId = useId();
  const genreId = useId();
  const descriptionId = useId();
  const nameEmpty = name.trim() === "";

  const flush = () => {
    clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length > 0) update.mutate(patch);
  };

  const schedule = (patch: WorldPatch) => {
    pending.current = { ...pending.current, ...patch };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  // Pending changes are saved when the section is left or the screen closes.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  const changeName = (value: string) => {
    setName(value);
    if (value.trim() === "") {
      const { name: _dropped, ...rest } = pending.current;
      pending.current = rest;
      return;
    }
    schedule({ name: value });
  };

  const error = update.error ?? setMainImage.error ?? reveal.error;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{t("worldSettings.autosave")}</p>

      <div className="flex flex-col gap-2">
        <div className="relative aspect-[21/9] overflow-hidden rounded-lg bg-muted">
          {world.mainImage ? (
            <AssetImage
              assetId={world.mainImage}
              alt={t("worldSettings.mainImage")}
              className="size-full object-cover"
            />
          ) : (
            <div
              className="flex size-full items-center justify-center text-muted-foreground"
              style={{ background: "var(--bz-backdrop-gradient)" }}
            >
              <ImagePlus aria-hidden className="size-8" />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPickerOpen(true)}
            disabled={setMainImage.isPending}
          >
            <ImagePlus />
            {world.mainImage ? t("worldSettings.changeImage") : t("worldSettings.chooseImage")}
          </Button>
          {world.mainImage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMainImage.mutate(null)}
              disabled={setMainImage.isPending}
            >
              <Trash2 />
              {t("worldSettings.removeImage")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="text-sm font-medium">
            {t("worldSettings.name")}
          </label>
          <Input
            id={nameId}
            value={name}
            maxLength={120}
            aria-invalid={nameEmpty}
            aria-describedby={nameEmpty ? `${nameId}-error` : undefined}
            onChange={(event) => changeName(event.target.value)}
          />
          {nameEmpty && (
            <p id={`${nameId}-error`} className="text-xs text-destructive">
              {t("worldSettings.nameRequired")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={genreId} className="text-sm font-medium">
            {t("createWorld.genre")}
          </label>
          <Select
            value={world.genre}
            onValueChange={(value) => {
              if (isGenre(value)) update.mutate({ genre: value });
            }}
          >
            <SelectTrigger id={genreId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GENRES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {t(label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={descriptionId} className="text-sm font-medium">
          {t("worldSettings.worldDescription")}
        </label>
        <textarea
          id={descriptionId}
          value={description}
          rows={5}
          maxLength={4000}
          placeholder={t("worldSettings.descriptionPlaceholder")}
          onChange={(event) => {
            setDescription(event.target.value);
            schedule({ description: event.target.value });
          }}
          className="min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <fieldset className="flex min-w-0 flex-col gap-1.5 border-0">
        <legend className="mb-1.5 text-sm font-medium">{t("worldSettings.folder")}</legend>
        <div className="flex items-center gap-2">
          <code
            title={world.path}
            className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs"
          >
            {world.path}
          </code>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => reveal.mutate(world.path)}
            disabled={reveal.isPending}
          >
            <FolderOpen />
            {t("worldSettings.openFolder")}
          </Button>
        </div>
      </fieldset>

      {error && <AppErrorMessage error={error} />}
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {update.isPending || setMainImage.isPending ? t("worldSettings.saving") : ""}
      </p>

      <ImagePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedId={world.mainImage}
        title={t("worldSettings.pickerTitle")}
        onPick={(assetId) => setMainImage.mutate(assetId)}
      />
    </div>
  );
}
