import { Link } from "@tanstack/react-router";
import {
  type LucideIcon,
  Music,
  Pause,
  Play,
  Radio,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { useEffect, useId } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/app/stores/ui";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAssets } from "@/features/media";
import type { TranslationKey } from "@/i18n";
import type { RadioMode } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { useRadio } from "../player";

const MODES: { value: RadioMode; icon: LucideIcon; label: TranslationKey }[] = [
  { value: "loop", icon: Repeat, label: "radio.mode.loop" },
  { value: "repeatOne", icon: Repeat1, label: "radio.mode.repeatOne" },
  { value: "shuffle", icon: Shuffle, label: "radio.mode.shuffle" },
];

/**
 * Keeps the radio's track list in sync with the audio files of the media
 * library, and stops the music when the world closes (the top bar unmounts).
 */
function useRadioTracks() {
  const audio = useAssets({ kind: "audio", search: null });
  const setTracks = useRadio((state) => state.setTracks);

  useEffect(() => {
    if (audio.data) setTracks(audio.data.map(({ id, name }) => ({ id, name })));
  }, [audio.data, setTracks]);

  useEffect(() => () => useRadio.getState().stop(), []);
}

/** "Radio" button of the top bar: ambient player for the world's audio files. */
export function RadioButton({ worldId }: { worldId: string }) {
  const { t } = useTranslation();
  useRadioTracks();
  const { tracks, currentId, playing, toggle, next, previous, play } = useRadio();
  const volume = useUiStore((state) => state.radioVolume);
  const setVolume = useUiStore((state) => state.setRadioVolume);
  const mode = useUiStore((state) => state.radioMode);
  const setMode = useUiStore((state) => state.setRadioMode);
  const volumeId = useId();
  const current = tracks.find((track) => track.id === currentId);
  const empty = tracks.length === 0;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={playing ? t("radio.buttonPlaying") : t("radio.button")}
              className={cn("rounded-full", playing && "text-primary")}
            >
              <Radio />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{current && playing ? current.name : t("radio.button")}</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="glass flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Music aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <p className="truncate font-medium" aria-live="polite">
            {current ? current.name : t("radio.nothing")}
          </p>
        </div>

        {empty ? (
          <p className="text-sm text-muted-foreground">
            {t("radio.empty")}{" "}
            <Link
              to="/world/$worldId/media"
              params={{ worldId }}
              className="text-foreground underline underline-offset-4"
            >
              {t("media.title")}
            </Link>
          </p>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("radio.previous")}
                onClick={previous}
                className="rounded-full"
              >
                <SkipBack />
              </Button>
              <Button
                size="icon"
                aria-label={playing ? t("radio.pause") : t("radio.play")}
                onClick={toggle}
                className="size-11 rounded-full"
              >
                {playing ? <Pause /> : <Play />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("radio.next")}
                onClick={next}
                className="rounded-full"
              >
                <SkipForward />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor={volumeId}>
                <Volume2 aria-hidden className="size-4 text-muted-foreground" />
                <span className="sr-only">{t("radio.volume")}</span>
              </label>
              <input
                id={volumeId}
                type="range"
                min={0}
                max={100}
                step={1}
                value={volume}
                aria-valuetext={t("radio.volumeValue", { volume })}
                onChange={(event) => setVolume(event.target.valueAsNumber)}
                className="h-1.5 flex-1 cursor-pointer accent-primary"
              />
            </div>

            <fieldset className="flex justify-center gap-1 border-0">
              <legend className="sr-only">{t("radio.mode.label")}</legend>
              {MODES.map(({ value, icon: Icon, label }) => (
                <Tooltip key={value}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={mode === value ? "secondary" : "ghost"}
                      size="icon-sm"
                      aria-pressed={mode === value}
                      aria-label={t(label)}
                      onClick={() => setMode(value)}
                      className={cn("rounded-full", mode !== value && "text-muted-foreground")}
                    >
                      <Icon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t(label)}</TooltipContent>
                </Tooltip>
              ))}
            </fieldset>

            <ul
              aria-label={t("radio.tracks")}
              className="-mx-2 flex max-h-48 flex-col overflow-y-auto"
            >
              {tracks.map((track) => (
                <li key={track.id}>
                  <button
                    type="button"
                    aria-current={track.id === currentId ? "true" : undefined}
                    onClick={() => play(track.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50",
                      track.id === currentId ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <span className="truncate">{track.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
