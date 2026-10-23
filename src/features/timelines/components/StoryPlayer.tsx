import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/** How long each item stays before the next, while playing. */
export const STEP_MS = 5000;

type Props = {
  /** The items told, in time order. */
  count: number;
  index: number;
  onIndex: (index: number) => void;
  onExit: () => void;
};

/**
 * « Lecture » (M11+, #417): the timeline told item by item. Replaces the
 * toolbar while it runs: previous, play / pause, next, where it is, exit.
 * Arrows, Space and Escape do the same from the keyboard; it moves on
 * every few seconds while playing.
 */
export function StoryPlayer({ count, index, onIndex, onExit }: Props) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(true);
  const latest = useRef({ index, count, onIndex, onExit, playing });
  latest.current = { index, count, onIndex, onExit, playing };
  const last = index >= count - 1;

  // Playing: the next item after a while; the last one stops the playing.
  useEffect(() => {
    if (!playing) return;
    if (last) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => onIndex(index + 1), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, last, index, onIndex]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const current = latest.current;
      if (event.key === "ArrowRight")
        current.onIndex(Math.min(current.count - 1, current.index + 1));
      else if (event.key === "ArrowLeft") current.onIndex(Math.max(0, current.index - 1));
      else if (event.key === " ") setPlaying((was) => !was);
      else if (event.key === "Escape") current.onExit();
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    // Before the drawing's own keys (arrows pan it otherwise).
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div
      role="toolbar"
      aria-label={t("timelines.story.label")}
      className="glass absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full p-1 shadow-lg"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label={t("timelines.story.previous")}
        title={t("timelines.story.previous")}
        disabled={index === 0}
        onClick={() => onIndex(index - 1)}
      >
        <ChevronLeft />
      </Button>
      <Button
        size="icon-sm"
        className="rounded-full"
        aria-label={playing ? t("timelines.story.pause") : t("timelines.story.play")}
        title={playing ? t("timelines.story.pause") : t("timelines.story.play")}
        onClick={() => {
          // Played to the end: playing again starts over.
          if (!playing && last) onIndex(0);
          setPlaying(!playing);
        }}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label={t("timelines.story.next")}
        title={t("timelines.story.next")}
        disabled={last}
        onClick={() => onIndex(index + 1)}
      >
        <ChevronRight />
      </Button>
      <span className="px-2 text-xs text-muted-foreground tabular-nums" aria-live="polite">
        {t("timelines.story.position", { index: index + 1, count })}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full"
        onClick={onExit}
        aria-label={t("timelines.story.exit")}
      >
        <X />
        {t("timelines.story.exitShort")}
      </Button>
    </div>
  );
}
