import { Link } from "@tanstack/react-router";
import { ImagePlus, Images, Palette, Settings2, Shapes } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Atlas } from "@/app/shell/Atlas";
import { useUiStore } from "@/app/stores/ui";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import { useCardCounts, useWorldStats } from "@/features/cards";
import { HomeGraphPreview } from "@/features/graphs";
import { AssetImage, useAssets } from "@/features/media";
import { genreLabel, ToneList, useCurrentWorld } from "@/features/world";
import { cn } from "@/lib/utils";
import { RecentDocuments } from "./RecentDocuments";

const ENTRY_CLASS =
  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-none transition-colors duration-(--bz-duration-fast) ease-atlas hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

/** One figure of the world: the number, its name, a fine line ending in a gold dot (after vvd). */
function Stat({ value, label }: { value: number | undefined; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-heading text-2xl leading-none font-bold lining-nums tabular-nums">
        {value === undefined ? "–" : value.toLocaleString()}
      </span>
      <span aria-hidden className="relative h-px w-20 bg-border-strong">
        <span className="absolute -top-0.5 right-0 size-1.5 rounded-full bg-primary" />
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn("glass-panel flex flex-col gap-3 rounded-lg p-4", className)}
    >
      <h2 id={headingId} className="rubric">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Home tab: the landing page of the open world (V2, ADR 0012). Its header is
 * the world itself: its cover (or its own atlas), its name, genre,
 * description and key figures. Below, the way back into its documents, the
 * world's graph (M5) and the « Manage » block.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const { data: world } = useCurrentWorld();
  const assets = useAssets({ kind: null, search: null });
  const cardCounts = useCardCounts();
  const stats = useWorldStats();
  const types = useCardTypes();
  const openWorldSettings = useUiStore((state) => state.openWorldSettings);
  const openCardTypes = useUiStore((state) => state.setCardTypesOpen);

  if (!world) return null;
  const fileCount = assets.data?.length;
  const counts = cardCounts.data;
  const cardTotal = counts?.reduce((sum, { count }) => sum + count, 0);
  // Subtypes count for their type; types in their order, empty ones left out.
  const allTypes = types.data ?? [];
  const byType = allTypes
    .filter((type) => type.parentId === null)
    .map((type) => ({
      type,
      count: (counts ?? [])
        .filter(({ typeId }) => {
          const counted = allTypes.find((candidate) => candidate.id === typeId);
          return typeId === type.id || counted?.parentId === type.id;
        })
        .reduce((sum, { count }) => sum + count, 0),
    }))
    .filter(({ count }) => count > 0);

  const cover = world.mainImage;

  return (
    <main className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 overflow-y-auto px-8 pt-6 pb-8">
      <header className="glass-panel relative flex min-h-72 shrink-0 flex-col justify-end overflow-hidden rounded-xl">
        <div aria-hidden className="absolute inset-0">
          {cover ? (
            <AssetImage assetId={cover} alt="" className="size-full object-cover" />
          ) : (
            <div
              className="relative size-full"
              style={
                {
                  background: "var(--bz-backdrop-gradient)",
                  "--bz-atlas-ink": "var(--bz-atlas-ink-strong)",
                } as CSSProperties
              }
            >
              <Atlas seed={world.id} still />
            </div>
          )}
          {/* Paper rising from the bottom: the title and figures always read. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, var(--bz-surface-strong) 34%, color-mix(in oklab, var(--bz-surface-strong) 72%, transparent) 64%, transparent 96%)",
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => openWorldSettings("general")}
          className="glass-veil absolute top-3 right-3 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ImagePlus aria-hidden className="size-3.5" />
          {cover ? t("home.changeCover") : t("home.addCover")}
        </button>

        <div className="relative flex flex-col gap-3 p-6">
          <div className="flex flex-wrap items-center gap-1">
            <p className="rubric glass-veil rounded-full px-2.5 py-0.5">
              {t(genreLabel(world.genre))}
            </p>
            <ToneList tones={world.tones} className="contents" />
          </div>
          <h1 className="text-5xl leading-tight font-bold">
            {t("home.welcomeTo", { name: world.name })}
          </h1>
          {world.description ? (
            <p className="line-clamp-3 max-w-3xl whitespace-pre-line text-muted-foreground">
              {world.description}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => openWorldSettings("general")}
              className="self-start text-sm text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("home.addDescription")}
            </button>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span>{cardTotal === undefined ? "" : t("home.cardCount", { count: cardTotal })}</span>
            <span>{fileCount === undefined ? "" : t("home.fileCount", { count: fileCount })}</span>
            {byType.length > 0 && (
              <ul aria-label={t("home.cardsByType")} className="flex flex-wrap gap-1.5">
                {byType.map(({ type, count }) => {
                  const Icon = typeIcon(type.icon);
                  return (
                    <li
                      key={type.id}
                      className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs"
                    >
                      <Icon
                        aria-hidden
                        className="size-3.5"
                        style={{ color: typeColor(type.color) }}
                      />
                      {type.name}
                      <span className="text-muted-foreground">{count}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </header>

      {/* The world in three figures (V2-2+.2, after vvd's Home). */}
      <section aria-label={t("home.stats")} className="flex flex-wrap gap-x-10 gap-y-3 px-2">
        <Stat
          value={stats.data?.words}
          label={t("home.statsWords", { count: stats.data?.words ?? 0 })}
        />
        <Stat
          value={stats.data?.documents}
          label={t("home.statsDocuments", { count: stats.data?.documents ?? 0 })}
        />
        <Stat
          value={stats.data?.connections}
          label={t("home.statsConnections", { count: stats.data?.connections ?? 0 })}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* The world's graph takes the centre of its Home. */}
          <Section title={t("home.graph")}>
            <HomeGraphPreview worldId={world.id} large />
          </Section>

          <Section title={t("home.recent")}>
            <RecentDocuments worldId={world.id} />
          </Section>
        </div>

        <Section title={t("home.manage")} className="self-start">
          <nav aria-label={t("home.manage")} className="-mx-2 flex flex-col">
            <button
              type="button"
              onClick={() => openCardTypes(true)}
              className={cn(ENTRY_CLASS, "text-left")}
            >
              <Shapes aria-hidden className="size-4" />
              {t("home.types")}
            </button>
            <Link to="/world/$worldId/media" params={{ worldId: world.id }} className={ENTRY_CLASS}>
              <Images aria-hidden className="size-4" />
              {t("media.title")}
            </Link>
            <button
              type="button"
              onClick={() => openWorldSettings("theme")}
              className={cn(ENTRY_CLASS, "text-left")}
            >
              <Palette aria-hidden className="size-4" />
              {t("home.theme")}
            </button>
            <button
              type="button"
              onClick={() => openWorldSettings("general")}
              className={cn(ENTRY_CLASS, "text-left")}
            >
              <Settings2 aria-hidden className="size-4" />
              {t("home.settings")}
            </button>
          </nav>
        </Section>
      </div>
    </main>
  );
}
