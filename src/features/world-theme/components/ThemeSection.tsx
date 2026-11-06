import { Compass, ImagePlus, Pencil, Undo2 } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetImage, ImagePickerDialog } from "@/features/media";
import { usePreviewWorldTheme, useSetWorldTheme } from "@/features/world";
import type { Material, WorldInfo, WorldTheme } from "@/lib/bindings";
import { isHexColor, type Mode } from "../accent";
import { themeHeadingFont } from "../headingFonts";
import {
  ACCENT_SWATCHES,
  accentOf,
  DEFAULT_ACCENT,
  findPreset,
  PRESETS,
  resolveTheme,
} from "../presets";
import { themeLook } from "../useWorldMaterial";
import { themeScheme } from "../useWorldScheme";
import { ThemePreview } from "./ThemePreview";

/** Delay before a color dragged in the free color picker is saved. */
const COLOR_SAVE_DELAY_MS = 300;

const CARD_CLASS =
  "group relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-lg border border-border text-left outline-none transition-[border-color,box-shadow] duration-(--bz-duration-fast) ease-atlas hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:ring-2 data-[state=checked]:ring-primary";

/** Name, material, accent dot and « Actuel » over a theme card. */
function CardLabel({
  name,
  material,
  accent,
  current,
}: {
  name: string;
  material: Material;
  accent: string;
  current: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <span
        aria-hidden
        className="absolute top-1.5 right-1.5 size-3.5 rounded-full border-2 border-white/80 shadow"
        style={{ background: accent }}
      />
      {current && (
        <span
          aria-hidden
          className="absolute top-1.5 left-1.5 rounded-full bg-black/70 px-1.5 py-px text-[0.6875rem] font-medium text-white"
        >
          {t("worldTheme.current")}
        </span>
      )}
      <span className="relative flex flex-col bg-gradient-to-t from-black/85 via-black/60 to-transparent px-2 pt-6 pb-1.5 text-white">
        <span className="line-clamp-2 font-heading text-sm leading-tight font-bold">{name}</span>
        <span className="truncate text-[0.6875rem] leading-tight text-white/85">
          {t(`worldTheme.material.${material}`)}
        </span>
      </span>
    </>
  );
}

/** The gallery's value of `theme`: `""` for a custom theme, which is not in it. */
function galleryValue(theme: WorldTheme): string {
  if (theme.kind === "preset" && PRESETS.some((preset) => preset.id === theme.id)) return theme.id;
  return theme.kind === "custom" ? "" : "default";
}

function galleryTheme(value: string): WorldTheme {
  return value === "default" ? { kind: "default" } : { kind: "preset", id: value };
}

/**
 * "Explore": the default theme and the shipped ones on the left, and on the
 * right the world's Home and a card in the theme hovered or selected, light
 * and dark side by side (ADR 0015, « Galerie et aperçu »). Nothing applies
 * before « Appliquer » (or Enter); « Annuler » and Escape go back to the
 * current theme, a first Escape without closing the window.
 */
function ExploreTab({
  world,
  onApply,
}: {
  world: WorldInfo;
  onApply: (theme: WorldTheme) => void;
}) {
  const { t } = useTranslation();
  const current = galleryValue(world.theme);
  const [selected, setSelected] = useState(current);
  const [hovered, setHovered] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const pending = selected !== current;

  // The theme applied elsewhere (« Modifier », Apply) becomes the selection.
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setSelected(current);
  }

  const shown = hovered ?? selected;
  const previewed = shown === "" ? world.theme : galleryTheme(shown);
  const nameOf = (value: string) =>
    value === "default"
      ? t("worldTheme.default")
      : value === ""
        ? t("worldTheme.custom")
        : t(findPreset(value)?.name ?? "worldTheme.default");
  const imposed = themeScheme(previewed);
  const schemes: Mode[] = imposed ? [imposed] : ["light", "dark"];

  const apply = () => {
    if (pending && selected !== "") onApply(galleryTheme(selected));
  };
  const cancel = () => {
    setSelected(current);
    setHovered(null);
  };

  // A first Escape cancels the preview and keeps the window open. Radix
  // listens on the document while capturing: the window sees it before.
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !root.current?.contains(event.target as Node)) return;
      event.preventDefault();
      event.stopPropagation();
      cancelRef.current();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [pending]);

  const items = [
    {
      value: "default",
      name: t("worldTheme.default"),
      material: "vellum" as Material,
      accent: DEFAULT_ACCENT,
      image: null,
    },
    ...PRESETS.map((preset) => ({
      value: preset.id,
      name: t(preset.name),
      material: preset.look?.material ?? ("vellum" as Material),
      accent: accentOf(preset.accent, "dark"),
      image: preset.image,
    })),
  ];
  const previewTitle = t("worldTheme.previewOf", { name: nameOf(shown) });

  return (
    <div ref={root} className="grid grid-cols-[14rem_minmax(0,1fr)] gap-4">
      <RadioGroupPrimitive.Root
        aria-label={t("worldTheme.gallery")}
        value={selected}
        onValueChange={setSelected}
        onKeyDown={(event) => {
          if (event.key === "Enter") apply();
        }}
        onPointerLeave={() => setHovered(null)}
        className="grid grid-cols-2 content-start gap-2"
      >
        {items.map((item) => (
          <RadioGroupPrimitive.Item
            key={item.value}
            value={item.value}
            aria-label={
              item.value === current ? `${item.name}, ${t("worldTheme.current")}` : item.name
            }
            onPointerEnter={() => setHovered(item.value)}
            className={CARD_CLASS}
          >
            {item.image ? (
              <img
                src={item.image}
                alt=""
                draggable={false}
                className="absolute inset-0 size-full object-cover"
              />
            ) : world.mainImage ? (
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
            <CardLabel
              name={item.name}
              material={item.material}
              accent={item.accent}
              current={item.value === current}
            />
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>

      <section aria-label={previewTitle} className="flex min-w-0 flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-medium">{previewTitle}</h3>
          {shown === current && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("worldTheme.current")}
            </span>
          )}
        </div>
        <div className={schemes.length > 1 ? "grid grid-cols-2 gap-3" : "grid"}>
          {schemes.map((scheme) => (
            <figure key={scheme} className="flex min-w-0 flex-col gap-1.5">
              <ThemePreview world={world} theme={previewed} scheme={scheme} />
              <figcaption className="text-xs text-muted-foreground">
                {t(scheme === "light" ? "settings.theme.light" : "settings.theme.dark")}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={!pending} onClick={cancel}>
            {t("worldTheme.cancel")}
          </Button>
          <Button size="sm" disabled={!pending || selected === ""} onClick={apply}>
            {t("worldTheme.apply")}
          </Button>
        </div>
        <p aria-live="polite" className="sr-only">
          {pending ? t("worldTheme.previewing", { name: nameOf(selected) }) : ""}
        </p>
      </section>
    </div>
  );
}

/**
 * The look a shipped ambiance hands to « Modifier », its imposed mode
 * included (a customised Crypte stays dark); nothing for the others.
 */
function presetLook(
  theme: WorldTheme,
): Pick<
  Extract<WorldTheme, { kind: "custom" }>,
  "material" | "ornament" | "headingFont" | "scheme"
> {
  const { material, ornament } = themeLook(theme);
  const headingFont = themeHeadingFont(theme);
  const scheme = themeScheme(theme);
  return {
    ...(material !== "vellum" && { material }),
    ...(ornament !== "none" && { ornament }),
    ...(headingFont !== "alegreya" && { headingFont }),
    ...(scheme && { scheme }),
  };
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

  // Starts from what is shown: the current accent (both of an ambiance that
  // has one per mode), its material, ornament and heading font, the main
  // image, and the mode it imposes.
  const shownAccent = resolveTheme(world.theme, world.mainImage).accent;
  const current: Extract<WorldTheme, { kind: "custom" }> =
    world.theme.kind === "custom"
      ? world.theme
      : {
          kind: "custom",
          background: null,
          accent: shownAccent ? accentOf(shownAccent, "dark") : DEFAULT_ACCENT,
          ...(shownAccent && typeof shownAccent !== "string" && { accentLight: shownAccent.light }),
          ...presetLook(world.theme),
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
  // Another accent is one color, made readable in each mode.
  const withAccent = (accent: string): WorldTheme => {
    const { accentLight: _, ...rest } = current;
    return { ...rest, accent };
  };

  // The free color is shown at once and saved when the drag settles.
  const dragColor = (accent: string) => {
    if (!isHexColor(accent)) return;
    const theme = withAccent(accent.toLowerCase());
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
            onValueChange={(accent) => onChange(withAccent(accent))}
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
 * "Theme" section of the world settings: "Explore" the themes
 * shipped with the app in a gallery with a preview, applied with « Appliquer »,
 * or "Edit" the world's own, whose changes apply at once.
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
          <ExploreTab world={world} onApply={(theme) => setTheme.mutate(theme)} />
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
