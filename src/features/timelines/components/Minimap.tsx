import { type KeyboardEvent, type PointerEvent, useRef } from "react";
import { useTranslation } from "react-i18next";
import { typeColor } from "@/features/card-types";
import type { Timeline, WorldCalendar } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { formatDate } from "../calendar";
import { eraBands, extent, itemEnd } from "../scale";
import { useCalendarWords } from "../useCalendar";

/** The days the view shows (left and right edges). */
export type Shown = { from: number; to: number };

type Props = {
  timeline: Timeline;
  calendar: WorldCalendar;
  shown: Shown;
  /** Centres the view on a day. */
  onCenter: (day: number) => void;
};

/** One arrow key moves the view by this share of the whole timeline. */
const KEY_STEP = 0.05;

/**
 * The whole timeline in a thin strip (M11+, #416): its eras, its items, and
 * the part the view shows. A click or a drag there centres the view; from
 * the keyboard it is a slider (arrows, Page Up / Down, Home / End).
 */
export function Minimap({ timeline, calendar, shown, onCenter }: Props) {
  const { t } = useTranslation();
  const words = useCalendarWords();
  const strip = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const items = extent(calendar, timeline.items);
  // The strip spans the items and the view, with a little room on both sides.
  const low = Math.min(items?.from ?? shown.from, shown.from);
  const high = Math.max(items?.to ?? shown.to, shown.to);
  const pad = Math.max(1, (high - low) * 0.03);
  const from = low - pad;
  const span = Math.max(1, high + pad - from);
  const at = (day: number) => ((day - from) / span) * 100;
  const center = (shown.from + shown.to) / 2;

  const dayAtPointer = (clientX: number) => {
    const box = strip.current?.getBoundingClientRect();
    if (!box || box.width === 0) return center;
    return from + ((clientX - box.left) / box.width) * span;
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    onCenter(dayAtPointer(event.clientX));
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) onCenter(dayAtPointer(event.clientX));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = span * KEY_STEP;
    const moves: Record<string, number> = {
      ArrowLeft: center - step,
      ArrowDown: center - step,
      ArrowRight: center + step,
      ArrowUp: center + step,
      PageDown: center - step * 4,
      PageUp: center + step * 4,
      Home: items?.from ?? center,
      End: items?.to ?? center,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onCenter(next);
  };

  const left = Math.max(0, at(shown.from));
  const right = Math.min(100, at(shown.to));
  return (
    <div
      ref={strip}
      role="slider"
      tabIndex={0}
      aria-label={t("timelines.minimap.label")}
      aria-valuemin={Math.round(from)}
      aria-valuemax={Math.round(from + span)}
      aria-valuenow={Math.round(center)}
      aria-valuetext={formatDate(calendar, Math.round(center), "year", words)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onKeyDown={onKeyDown}
      className="glass relative h-8 w-full cursor-pointer touch-none overflow-hidden rounded-lg outline-none select-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {eraBands(calendar).map((band, index) => {
        const bandLeft = Math.max(0, at(band.from));
        const bandRight = band.to === null ? 100 : Math.min(100, at(band.to + 1));
        if (bandRight <= 0 || bandLeft >= 100) return null;
        return (
          <div
            key={band.era.startYear}
            aria-hidden
            className={cn(
              "absolute inset-y-0 border-l border-primary/30",
              index % 2 === 0 ? "bg-primary/[0.06]" : "bg-transparent",
            )}
            style={{ left: `${bandLeft}%`, width: `${Math.max(0, bandRight - bandLeft)}%` }}
          />
        );
      })}
      <div aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-foreground/25" />
      {timeline.items.map((item) =>
        item.end === null ? (
          <span
            key={item.id}
            aria-hidden
            className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${at(item.start)}%`, backgroundColor: typeColor(item.color) }}
          />
        ) : (
          <span
            key={item.id}
            aria-hidden
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
            style={{
              left: `${at(item.start)}%`,
              width: `${Math.max(0.3, at(itemEnd(calendar, item) + 1) - at(item.start))}%`,
              backgroundColor: typeColor(item.color),
            }}
          />
        ),
      )}
      {/* The part the view shows. */}
      <div
        aria-hidden
        className="absolute inset-y-0.5 rounded-md border-2 border-primary bg-primary/10"
        style={{ left: `${left}%`, width: `${Math.max(0.8, right - left)}%` }}
      />
    </div>
  );
}
