import { convertFileSrc } from "@tauri-apps/api/core";
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RecentWorld } from "@/lib/bindings";
import { genreLabel } from "../genres";

/** Protocol serving cached world thumbnails (src-tauri/src/thumbnails.rs). */
const THUMBNAIL_SCHEME = "bzthumb";

function formatDate(iso: string, language: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

type WorldCardProps = {
  world: RecentWorld;
  disabled: boolean;
  onOpen: () => void;
};

/** A world in the start screen grid: thumbnail, name, genre, last opening. */
export function WorldCard({ world, disabled, onOpen }: WorldCardProps) {
  const { t, i18n } = useTranslation();
  // The query only busts the WebView cache when the thumbnail is regenerated.
  const thumbnail =
    world.thumbnail && world.id
      ? `${convertFileSrc(world.id, THUMBNAIL_SCHEME)}?v=${encodeURIComponent(world.lastOpenedAt)}`
      : undefined;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      aria-label={t("worlds.openRecent", { name: world.name })}
      className="glass group flex w-full flex-col overflow-hidden rounded-lg text-left transition outline-none hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div
            className="flex size-full items-center justify-center"
            style={{ background: "var(--bz-backdrop-gradient)" }}
          >
            <Globe aria-hidden className="size-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <span className="truncate font-heading font-bold">{world.name}</span>
        <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{world.genre ? t(genreLabel(world.genre)) : ""}</span>
          <span className="shrink-0">{formatDate(world.lastOpenedAt, i18n.language)}</span>
        </span>
      </div>
    </button>
  );
}
