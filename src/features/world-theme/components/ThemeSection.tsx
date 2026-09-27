import { Check, Compass, ImagePlus, Pencil, Undo2 } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetImage, ImagePickerDialog } from "@/features/media";
import { usePreviewWorldTheme, useSetWorldTheme } from "@/features/world";
import type { WorldInfo, WorldTheme } from "@/lib/bindings";
import { isHexColor } from "../accent";
import { ACCENT_SWATCHES, DEFAULT_ACCENT, PRESETS, resolveTheme } from "../presets";

/** Delay before a color dragged in the free color picker is saved. */
const COLOR_SAVE_DELAY_MS = 300;

const CARD_CLASS =
  "group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-xl border border-border text-left outline-none transition hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:ring-2 data-[state=checked]:ring-primary";

/** Name and accent dot over the bottom of a theme card. */
function CardLabel({ name, accent }: { name: string; accent: string }) {
  return (
    <>
      <span
        aria-hidden
        className="absolute top-2 right-2 size-4 rounded-full border-2 border-white/80 shadow"
        style={{ background: accent }}
      />
      <span className="relative bg-gradient-to-t from-black/75 to-transparent px-3 pt-8 pb-2.5 font-heading text-base font-bold text-white">
        {name}
      </span>
      <Check
        aria-hidden
        className="absolute top-2 left-2 hidden size-5 rounded-full bg-primary p-0.5 text-primary-foreground group-data-[state=checked]:block"
      />
    </>
  );
}

/** "Explore": the default theme and the themes shipped with the app. */
function ExploreTab({
  world,
  onChange,
}: {
  world: WorldInfo;
  onChange: (theme: WorldTheme) => void;
}) {
  const { t } = useTranslation();
  const { theme } = world;
  const value =
    theme.kind === "preset" && PRESETS.some((preset) => preset.id === theme.id)
      ? theme.id
      : theme.kind === "custom"
        ? ""
        : "default";

  return (
    <RadioGroupPrimitive.Root
      aria-label={t("worldTheme.gallery")}
      value={value}
      onValueChange={(next) =>
        onChange(next === "default" ? { kind: "default" } : { kind: "preset", id: next })
      }
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    >
      <RadioGroupPrimitive.Item
        value="default"
        aria-label={t("worldTheme.default")}
        className={CARD_CLASS}
      >
        {world.mainImage ? (
          <AssetImage
            assetId={world.mainImage}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: "var(--bz-backdrop-gradient)" }}
          />
        )}
        <CardLabel name={t("worldTheme.default")} accent={DEFAULT_ACCENT} />
      </RadioGroupPrimitive.Item>
      {PRESETS.map((preset) => (
        <RadioGroupPrimitive.Item
          key={preset.id}
          value={preset.id}
          aria-label={t(preset.name)}
          className={CARD_CLASS}
        >
          <img
            src={preset.image}
            alt=""
            draggable={false}
            className="absolute inset-0 size-full object-cover"
          />
          <CardLabel name={t(preset.name)} accent={preset.accent} />
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}

/** "Edit": the world's own theme, background from the media library and accent color. */
function EditTab({
  world,
  onChange,
  onPreview,
}: {
  world: WorldInfo;
  onChange: (theme: WorldTheme) => void;
  onPreview: (theme: WorldTheme) => void;
}) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const colorId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<WorldTheme | null>(null);

  // Starts from what is shown: the current accent, the main image.
  const current =
    world.theme.kind === "custom"
      ? world.theme
      : {
          kind: "custom" as const,
          background: null,
          accent: resolveTheme(world.theme, world.mainImage).accent ?? DEFAULT_ACCENT,
        };
  const isCustom = world.theme.kind === "custom";
  const background = current.background ?? world.mainImage;

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current) onChange(pending.current);
    pending.current = null;
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  const set = (changes: Partial<Omit<typeof current, "kind">>) =>
    onChange({ ...current, ...changes });

  // The free color is shown at once and saved when the drag settles.
  const dragColor = (accent: string) => {
    if (!isHexColor(accent)) return;
    const theme = { ...current, accent: accent.toLowerCase() };
    onPreview(theme);
    pending.current = theme;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, COLOR_SAVE_DELAY_MS);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {isCustom ? t("worldTheme.customActive") : t("worldTheme.customHint")}
      </p>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("worldTheme.background")}</h3>
        <div className="relative aspect-[21/9] overflow-hidden rounded-lg bg-muted">
          {background ? (
            <AssetImage
              assetId={background}
              alt={t("worldTheme.backgroundPreview")}
              className="size-full object-cover"
            />
          ) : (
            <div
              className="flex size-full items-center justify-center text-sm text-muted-foreground"
              style={{ background: "var(--bz-backdrop-gradient)" }}
            >
              {t("worldTheme.noBackground")}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {current.background ? t("worldTheme.backgroundChosen") : t("worldTheme.backgroundMain")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
            <ImagePlus />
            {t("worldTheme.chooseBackground")}
          </Button>
          {current.background && (
            <Button variant="ghost" size="sm" onClick={() => set({ background: null })}>
              <Undo2 />
              {t("worldTheme.useMainImage")}
            </Button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("worldTheme.accent")}</h3>
        <div className="flex flex-wrap items-center gap-3">
          <RadioGroupPrimitive.Root
            aria-label={t("worldTheme.accentSwatches")}
            value={ACCENT_SWATCHES.find((swatch) => swatch.color === current.accent)?.color ?? ""}
            onValueChange={(accent) => set({ accent })}
            className="flex flex-wrap gap-2"
          >
            {ACCENT_SWATCHES.map((swatch) => (
              <RadioGroupPrimitive.Item
                key={swatch.color}
                value={swatch.color}
                aria-label={t(swatch.name)}
                title={t(swatch.name)}
                className="flex size-8 items-center justify-center rounded-full border-2 border-transparent outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=checked]:border-foreground"
              >
                <span
                  aria-hidden
                  className="size-6 rounded-full"
                  style={{ background: swatch.color }}
                />
              </RadioGroupPrimitive.Item>
            ))}
          </RadioGroupPrimitive.Root>
          <label htmlFor={colorId} className="flex items-center gap-2 text-sm">
            <input
              id={colorId}
              type="color"
              value={current.accent}
              onChange={(event) => dragColor(event.target.value)}
              onBlur={flush}
              className="size-8 cursor-pointer rounded-full border border-border bg-transparent p-0.5"
            />
            {t("worldTheme.freeColor")}
            <code className="font-mono text-xs text-muted-foreground">{current.accent}</code>
          </label>
        </div>
      </section>

      <ImagePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedId={current.background}
        title={t("worldTheme.pickerTitle")}
        onPick={(assetId) => set({ background: assetId })}
      />
    </div>
  );
}

/**
 * "Theme" section of the world settings (after vvd): "Explore" the themes
 * shipped with the app, or "Edit" the world's own. A choice applies at once.
 */
export function ThemeSection({ world }: { world: WorldInfo }) {
  const { t } = useTranslation();
  const setTheme = useSetWorldTheme();
  const preview = usePreviewWorldTheme();
  const [tab, setTab] = useState(world.theme.kind === "custom" ? "edit" : "explore");

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList aria-label={t("worldTheme.tabs")} className="h-9">
          <TabsTrigger value="explore" className="px-3">
            <Compass />
            {t("worldTheme.explore")}
          </TabsTrigger>
          <TabsTrigger value="edit" className="px-3">
            <Pencil />
            {t("worldTheme.edit")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="explore">
          <ExploreTab world={world} onChange={(theme) => setTheme.mutate(theme)} />
        </TabsContent>
        <TabsContent value="edit">
          <EditTab world={world} onChange={(theme) => setTheme.mutate(theme)} onPreview={preview} />
        </TabsContent>
      </Tabs>
      {setTheme.error && <AppErrorMessage error={setTheme.error} />}
      <p aria-live="polite" className="sr-only">
        {setTheme.isSuccess ? t("worldTheme.applied") : ""}
      </p>
    </div>
  );
}
