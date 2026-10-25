import { ArrowRight, FolderOpen, FolderSearch, Globe, MoreHorizontal, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Atlas } from "@/app/shell/Atlas";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RecentWorld } from "@/lib/bindings";
import { genreLabel } from "../genres";
import { relativeTime } from "../relativeTime";
import { thumbnailUrl } from "../thumbnails";

type WorldCardProps = {
  world: RecentWorld;
  /** The folder no longer holds this world: it can only be relocated or removed. */
  missing: boolean;
  disabled: boolean;
  /** The last opened world, shown large at the top of the list. */
  featured?: boolean;
  onOpen: () => void;
  onRelocate: () => void;
  onReveal: () => void;
  onRemove: () => void;
};

function Cover({ url, seed }: { url: string | undefined; seed: string }) {
  return url ? (
    <img
      src={url}
      alt=""
      className="size-full object-cover transition-transform duration-(--bz-duration-slow) ease-atlas group-hover:scale-[1.04] motion-reduce:transition-none"
    />
  ) : (
    // No image: the world's own atlas, the relief it will have once open.
    <div
      className="relative size-full"
      style={
        {
          background: "var(--bz-backdrop-gradient)",
          // A small map needs a darker ink to read.
          "--bz-atlas-ink": "var(--bz-atlas-ink-strong)",
        } as CSSProperties
      }
    >
      <Atlas seed={seed} still />
    </div>
  );
}

/**
 * A world of the start screen, as a folio of the atlas: its cover, its name
 * in the serif, its genre and when it was last opened, and its menu. The
 * featured one (the last opened) is a wide banner with « Reprendre ».
 */
export function WorldCard({
  world,
  missing,
  disabled,
  featured = false,
  onOpen,
  onRelocate,
  onReveal,
  onRemove,
}: WorldCardProps) {
  const { t, i18n } = useTranslation();
  const thumbnail = missing ? undefined : thumbnailUrl(world);
  const genre = world.genre ? t(genreLabel(world.genre)) : "";
  const opened = relativeTime(world.lastOpenedAt, i18n.language);
  const meta = [genre, opened].filter(Boolean).join(" · ");

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={t("worlds.menu", { name: world.name })}
          className="glass-veil absolute top-2 right-2 z-10 rounded-full"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {missing ? (
          <DropdownMenuItem onSelect={onRelocate}>
            <FolderSearch />
            {t("worlds.relocate")}
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onSelect={onOpen}>
              <Globe />
              {t("worlds.openAction")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onReveal}>
              <FolderOpen />
              {t("worlds.reveal")}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onRemove}>
          <Trash2 />
          {t("worlds.remove")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const missingVeil = missing && (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/80 p-3 text-center">
      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
        {t("worlds.missing")}
      </span>
      <span className="text-xs text-muted-foreground">{t("worlds.missingHint")}</span>
    </div>
  );

  const label = missing
    ? t("worlds.relocateNamed", { name: world.name })
    : t("worlds.openRecent", { name: world.name });

  if (featured) {
    return (
      <div className="glass-panel group relative w-full shrink-0 overflow-hidden rounded-xl">
        <button
          type="button"
          data-world-folio
          onClick={missing ? onRelocate : onOpen}
          disabled={disabled}
          aria-label={label}
          className="relative block h-64 w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:opacity-60"
        >
          <div className="absolute inset-0 overflow-hidden">
            <Cover url={thumbnail} seed={world.id ?? world.path} />
          </div>
          {/* The paper rises from the bottom so the title always reads on the image. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, var(--bz-surface-strong) 18%, color-mix(in oklab, var(--bz-surface-strong) 55%, transparent) 48%, transparent 78%)",
            }}
          />
          {missingVeil}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="rubric">{t("worlds.lastOpened")}</span>
              <span className="truncate font-heading text-4xl leading-tight font-bold">
                {world.name}
              </span>
              <span className="text-sm text-muted-foreground">{meta}</span>
            </div>
            {!missing && (
              <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-[inset_0_1px_0_var(--bz-button-sheen),var(--bz-shadow-veil)] transition-[background-color] duration-(--bz-duration-fast) group-hover:bg-[color-mix(in_oklab,var(--primary),var(--foreground)_12%)]">
                {t("worlds.resume")}
                <ArrowRight className="size-4" />
              </span>
            )}
          </div>
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div className="glass-panel group relative flex w-full flex-col overflow-hidden rounded-lg transition-[translate,box-shadow] duration-(--bz-duration-base) ease-atlas hover:-translate-y-0.5 hover:shadow-(--bz-shadow-float) motion-reduce:transition-none">
      <button
        type="button"
        data-world-folio
        onClick={missing ? onRelocate : onOpen}
        disabled={disabled}
        aria-label={label}
        className="flex flex-col text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:opacity-60"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          <Cover url={thumbnail} seed={world.id ?? world.path} />
          {missingVeil}
        </div>
        <div className="flex flex-col gap-0.5 px-3 pt-2.5 pb-3">
          <span className="truncate font-heading text-lg leading-snug font-bold">{world.name}</span>
          <span className="truncate text-xs text-muted-foreground">{meta}</span>
        </div>
      </button>
      {menu}
    </div>
  );
}
