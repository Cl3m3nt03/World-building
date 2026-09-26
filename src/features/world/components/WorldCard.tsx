import { FolderOpen, FolderSearch, Globe, MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { thumbnailUrl } from "../thumbnails";

function formatDate(iso: string, language: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

type WorldCardProps = {
  world: RecentWorld;
  /** The folder no longer holds this world: it can only be relocated or removed. */
  missing: boolean;
  disabled: boolean;
  onOpen: () => void;
  onRelocate: () => void;
  onReveal: () => void;
  onRemove: () => void;
};

/** A world in the start screen grid: thumbnail, name, genre, last opening, menu. */
export function WorldCard({
  world,
  missing,
  disabled,
  onOpen,
  onRelocate,
  onReveal,
  onRemove,
}: WorldCardProps) {
  const { t, i18n } = useTranslation();
  const thumbnail = missing ? undefined : thumbnailUrl(world);

  return (
    <div className="glass group relative flex w-full flex-col overflow-hidden rounded-lg">
      <button
        type="button"
        onClick={missing ? onRelocate : onOpen}
        disabled={disabled}
        aria-label={
          missing
            ? t("worlds.relocateNamed", { name: world.name })
            : t("worlds.openRecent", { name: world.name })
        }
        className="flex flex-col text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
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
          {missing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/80 p-3 text-center">
              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                {t("worlds.missing")}
              </span>
              <span className="text-xs text-muted-foreground">{t("worlds.missingHint")}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-0.5 p-3">
          <span className="truncate pr-8 font-heading font-bold">{world.name}</span>
          <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{world.genre ? t(genreLabel(world.genre)) : ""}</span>
            <span className="shrink-0">{formatDate(world.lastOpenedAt, i18n.language)}</span>
          </span>
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label={t("worlds.menu", { name: world.name })}
            className="absolute right-2 bottom-2 rounded-full"
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
    </div>
  );
}
