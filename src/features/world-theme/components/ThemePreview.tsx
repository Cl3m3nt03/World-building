import { Images, Palette, Settings2, Shapes } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBackdropVeil } from "@/app/shell/backdropVeil";
import { Button } from "@/components/ui/button";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import { useRecentDocuments, useWorldStats } from "@/features/cards";
import { Stat } from "@/features/home";
import { genreLabel } from "@/features/world";
import { useAssetUrl } from "@/lib/assets";
import type { WorldInfo, WorldTheme } from "@/lib/bindings";
import type { Mode } from "../accent";
import { resolveTheme } from "../presets";
import { themeScope } from "../themeScope";

/** The recent documents Home reads (RecentDocuments): the preview reads nothing more. */
const HOME_RECENT_COUNT = 8;

/** How much smaller than the app the preview is drawn. */
const PREVIEW_ZOOM = 0.55;

/**
 * The world's Home, reduced (header, figures, « Gérer »), and one of its
 * cards, shown in `theme` and `scheme` whatever the window's theme
 * (ADR 0015, « Galerie et aperçu »). The real tokens, fonts, material,
 * ornament and the veil computed for the theme's image, on a subtree
 * (`data-theme-preview`): no second webview. It only draws (`inert`): nothing
 * in it takes the focus, nothing in it writes.
 */
export function ThemePreview({
  world,
  theme,
  scheme,
}: {
  world: WorldInfo;
  theme: WorldTheme;
  scheme: Mode;
}) {
  const { t } = useTranslation();
  const stats = useWorldStats();
  const recent = useRecentDocuments(HOME_RECENT_COUNT);
  const types = useCardTypes();
  const [element, setElement] = useState<HTMLDivElement | null>(null);

  const resolved = resolveTheme(theme, world.mainImage);
  const assetUrl = useAssetUrl(resolved.backgroundAsset);
  const image = resolved.presetImage ?? assetUrl;
  const scope = useMemo(() => themeScope(theme), [theme]);
  const veil = useBackdropVeil(image, {
    element,
    key: `${scheme}|${scope["data-material"]}`,
  });

  const card = recent.data?.find((document) => document.kind === "card");
  const type = types.data?.find((candidate) => candidate.id === card?.typeId);
  const TypeIcon = typeIcon(type?.icon ?? "shapes");

  return (
    <div
      ref={setElement}
      {...scope}
      data-scheme={scheme}
      inert
      className="relative isolate overflow-hidden rounded-lg border border-border bg-background font-sans text-foreground"
    >
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        {image ? (
          <img
            key={image}
            src={image}
            alt=""
            draggable={false}
            className="absolute inset-0 size-full scale-110 animate-in object-cover fade-in-0 duration-(--bz-duration-base) ease-atlas"
            style={{ filter: "blur(calc(var(--bz-blur-backdrop) * 0.5))" }}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: "var(--bz-backdrop-gradient)" }} />
        )}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: veil ?? "var(--bz-backdrop-overlay)" }}
        />
      </div>

      <div className="relative flex flex-col gap-3 p-4" style={{ zoom: PREVIEW_ZOOM }}>
        <header className="glass-panel flex flex-col gap-2 rounded-xl p-4">
          <p className="rubric glass-veil self-start rounded-full px-2.5 py-0.5">
            {t(genreLabel(world.genre))}
          </p>
          <h1 className="text-3xl leading-tight font-bold">
            {t("home.welcomeTo", { name: world.name })}
          </h1>
          {world.description && (
            <p className="line-clamp-2 text-sm whitespace-pre-line text-muted-foreground">
              {world.description}
            </p>
          )}
        </header>

        <div className="flex gap-8 px-1">
          <Stat
            value={stats.data?.words}
            label={t("home.statsWords", { count: stats.data?.words ?? 0 })}
          />
          <Stat
            value={stats.data?.documents}
            label={t("home.statsDocuments", { count: stats.data?.documents ?? 0 })}
          />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_10rem] gap-3">
          <article className="glass-panel flex flex-col gap-2.5 rounded-lg p-4">
            <span className="flex items-center gap-1.5 self-start rounded-full bg-secondary px-2.5 py-0.5 text-xs">
              <TypeIcon
                aria-hidden
                className="size-3.5"
                style={{ color: typeColor(type?.color ?? "slate") }}
              />
              {type?.name ?? t("worldTheme.previewType")}
            </span>
            <h2 className="font-heading text-2xl leading-tight font-bold">
              {card?.title ?? t("worldTheme.previewCard")}
            </h2>
            <p className="rubric">{t("worldTheme.previewProperties")}</p>
            <div aria-hidden className="flex flex-col gap-1.5">
              <span className="h-2 w-11/12 rounded-full bg-muted" />
              <span className="h-2 w-3/4 rounded-full bg-muted" />
              <span className="h-2 w-5/6 rounded-full bg-muted" />
            </div>
            <Button size="sm" className="self-start" tabIndex={-1}>
              {t("worldTheme.previewAction")}
            </Button>
          </article>

          <section className="glass-panel flex flex-col gap-1 self-start rounded-lg p-3">
            <h2 className="rubric">{t("home.manage")}</h2>
            {(
              [
                [Shapes, t("home.types")],
                [Images, t("media.title")],
                [Palette, t("home.theme")],
                [Settings2, t("home.settings")],
              ] as const
            ).map(([Icon, label]) => (
              <span key={label} className="flex items-center gap-2 py-1 text-sm">
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="truncate">{label}</span>
              </span>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
