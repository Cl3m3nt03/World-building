import { LayoutGrid, Palette, Settings2 } from "lucide-react";
import { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/app/stores/ui";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AssetImage } from "@/features/media";
import { useSettings } from "@/features/settings";
import {
  genreLabel,
  TONES,
  thumbnailUrl,
  useCloseWorld,
  useCurrentWorld,
  useOpenWorld,
} from "@/features/world";
import { Atlas } from "./Atlas";

/** How many other worlds the island offers to switch to. */
const OTHER_WORLDS = 4;

const ENTRY =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm outline-none transition-colors duration-(--bz-duration-fast) ease-atlas hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Left island of the top bar: the open world. It opens a card of the world
 * (its cover or atlas, name, genre, description), the way to its settings
 * and theme, and a quick switch to the other recent worlds.
 */
export function WorldIsland() {
  const { t } = useTranslation();
  const { data: world } = useCurrentWorld();
  const settings = useSettings();
  const openWorld = useOpenWorld();
  const closeWorld = useCloseWorld();
  const openWorldSettings = useUiStore((state) => state.openWorldSettings);
  const [open, setOpen] = useState(false);

  const others = (settings.data?.recentWorlds ?? [])
    .filter((recent) => recent.path !== world?.path)
    .slice(0, OTHER_WORLDS);

  const settle = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          aria-label={t("shell.world.label", { name: world?.name ?? "" })}
          disabled={!world}
          className="glass-veil h-10 max-w-64 rounded-lg px-2.5 font-heading text-sm"
        >
          {world?.mainImage ? (
            <AssetImage
              assetId={world.mainImage}
              alt=""
              className="size-5 shrink-0 rounded-sm object-cover"
            />
          ) : (
            <span aria-hidden className="size-5 shrink-0 rounded-sm bg-primary/80" />
          )}
          <span className="truncate">{world?.name}</span>
        </Button>
      </PopoverTrigger>
      {world && (
        <PopoverContent
          align="start"
          aria-label={t("shell.world.card", { name: world.name })}
          className="w-80 overflow-hidden p-0"
        >
          <div className="relative h-28 overflow-hidden">
            {world.mainImage ? (
              <AssetImage assetId={world.mainImage} alt="" className="size-full object-cover" />
            ) : (
              <div
                aria-hidden
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
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: "linear-gradient(to top, var(--bz-surface-strong), transparent 75%)",
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5 px-4 pb-3">
            <span className="rubric">
              {[
                world.genre ? t(genreLabel(world.genre)) : "",
                ...world.tones.map((tone) => {
                  const label = TONES.find((item) => item.value === tone)?.label;
                  return label ? t(label) : "";
                }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <span className="font-heading text-xl leading-tight font-bold">{world.name}</span>
            {world.description ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">{world.description}</p>
            ) : (
              <button
                type="button"
                onClick={settle(() => openWorldSettings("general"))}
                className="self-start text-xs text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t("home.addDescription")}
              </button>
            )}
          </div>
          <div className="flex flex-col border-t border-border p-1.5">
            <button
              type="button"
              className={ENTRY}
              onClick={settle(() => openWorldSettings("general"))}
            >
              <Settings2 aria-hidden className="size-4 text-muted-foreground" />
              {t("home.settings")}
            </button>
            <button
              type="button"
              className={ENTRY}
              onClick={settle(() => openWorldSettings("theme"))}
            >
              <Palette aria-hidden className="size-4 text-muted-foreground" />
              {t("home.theme")}
            </button>
          </div>
          <div className="flex flex-col gap-0.5 border-t border-border p-1.5">
            <span className="rubric px-2.5 pt-1 pb-0.5">{t("shell.world.switch")}</span>
            {others.map((recent) => (
              <button
                key={recent.path}
                type="button"
                className={ENTRY}
                disabled={openWorld.isPending}
                onClick={settle(() => openWorld.mutate(recent.path))}
              >
                {recent.thumbnail ? (
                  <img
                    src={thumbnailUrl(recent)}
                    alt=""
                    className="size-6 shrink-0 rounded-sm object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="relative size-6 shrink-0 overflow-hidden rounded-sm"
                    style={{ background: "var(--bz-backdrop-gradient)" }}
                  >
                    <Atlas seed={recent.id ?? recent.path} still />
                  </span>
                )}
                <span className="truncate font-heading">{recent.name}</span>
              </button>
            ))}
            <button type="button" className={ENTRY} onClick={settle(() => closeWorld.mutate())}>
              <LayoutGrid aria-hidden className="size-4 text-muted-foreground" />
              {t("shell.world.allWorlds")}
            </button>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
