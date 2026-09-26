import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssetImage, ImagePickerDialog } from "@/features/media";
import type { WorldInfo, WorldPatch } from "@/lib/bindings";
import { GENRES, isGenre } from "../genres";
import { useSetWorldMainImage, useUpdateWorld } from "../hooks/useWorlds";

/** Delay before a typed change is saved. */
const SAVE_DELAY_MS = 500;

type WorldPanelProps = {
  world: WorldInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Panel of the open world, opened from the top bar: main image (through the
 * image picker), name, genre and description, saved as they are edited.
 */
export function WorldPanel({ world, open, onOpenChange }: WorldPanelProps) {
  const { t } = useTranslation();
  const update = useUpdateWorld();
  const setMainImage = useSetWorldMainImage();
  const [name, setName] = useState(world.name);
  const [description, setDescription] = useState(world.description);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pending = useRef<WorldPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nameId = useId();
  const genreId = useId();
  const descriptionId = useId();
  const nameEmpty = name.trim() === "";

  // Fresh values each time the panel opens.
  useEffect(() => {
    if (open) {
      setName(world.name);
      setDescription(world.description);
    }
  }, [open, world.name, world.description]);

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

  // Pending changes are saved when the panel closes or unmounts.
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

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) flush();
          onOpenChange(next);
        }}
      >
        <DialogContent className="glass top-16 left-4 max-h-[calc(100vh-5rem)] translate-x-0 translate-y-0 overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("worldPanel.title")}</DialogTitle>
            <DialogDescription>{t("worldPanel.description")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
              {world.mainImage ? (
                <AssetImage
                  assetId={world.mainImage}
                  alt={t("worldPanel.mainImage")}
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
                className="flex-1"
                onClick={() => setPickerOpen(true)}
                disabled={setMainImage.isPending}
              >
                <ImagePlus />
                {world.mainImage ? t("worldPanel.changeImage") : t("worldPanel.chooseImage")}
              </Button>
              {world.mainImage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMainImage.mutate(null)}
                  disabled={setMainImage.isPending}
                >
                  <Trash2 />
                  {t("worldPanel.removeImage")}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={nameId} className="text-sm font-medium">
              {t("worldPanel.name")}
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
                {t("worldPanel.nameRequired")}
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

          <div className="flex flex-col gap-1.5">
            <label htmlFor={descriptionId} className="text-sm font-medium">
              {t("worldPanel.worldDescription")}
            </label>
            <textarea
              id={descriptionId}
              value={description}
              rows={5}
              maxLength={4000}
              placeholder={t("worldPanel.descriptionPlaceholder")}
              onChange={(event) => {
                setDescription(event.target.value);
                schedule({ description: event.target.value });
              }}
              className="min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {(update.error ?? setMainImage.error) && (
            <AppErrorMessage error={update.error ?? setMainImage.error} />
          )}
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {update.isPending || setMainImage.isPending ? t("worldPanel.saving") : ""}
          </p>
        </DialogContent>
      </Dialog>

      <ImagePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedId={world.mainImage}
        title={t("worldPanel.pickerTitle")}
        onPick={(assetId) => setMainImage.mutate(assetId)}
      />
    </>
  );
}
