import type { TFunction } from "i18next";
import {
  type CSSProperties,
  forwardRef,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { typeColor } from "@/features/card-types";
import { AssetImage } from "@/features/media";
import type { Card, DatePrecision, Timeline, TimelineItem, WorldCalendar } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { type CalendarWords, formatDate } from "../calendar";
import {
  centerOn,
  clampScale,
  eraBands,
  extent,
  frame,
  itemEnd,
  labelled,
  lanes,
  ticks,
  type Viewport,
  xOf,
  zoomAt,
} from "../scale";
import { useCalendarWords } from "../useCalendar";

/** Height of the ruler (ticks, then eras), of a lane, and a track's padding. */
const RULER_H = 48;
const LANE_H = 34;
const TRACK_PAD = 10;
/** Items further than this off the view are drawn at its edge (out of sight). */
const BLEED = 2000;
/** One key press pans this share of the view. */
const PAN_STEP = 0.15;
/** One key press (or button) zooms by this factor. */
export const ZOOM_STEP = 1.6;

export type TimelineViewHandle = {
  fitAll: () => void;
  zoom: (factor: number) => void;
  /** Centres the view on a date, zooming in enough to see its unit. */
  goTo: (day: number, precision: DatePrecision) => void;
  /** The day in the middle of the view. */
  center: () => number;
};

type Props = {
  timeline: Timeline;
  calendar: WorldCalendar;
  cardsById: ReadonlyMap<string, Card>;
  /** Its accessible name. */
  label: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

/** What an item is called: its own title, or its card's. */
export function itemTitle(item: TimelineItem, card: Card | undefined): string {
  return item.title.trim() || card?.title || "";
}

/** « Rébellion de Robert, de 282 DC à 283 DC », « Conquête, 1 DC ». */
export function itemLabel(
  t: TFunction,
  calendar: WorldCalendar,
  words: CalendarWords,
  item: TimelineItem,
  title: string,
): string {
  const start = formatDate(calendar, item.start, item.precision, words);
  if (item.end === null) return t("timelines.item.event", { title, date: start });
  const end = formatDate(calendar, item.end, item.precision, words);
  return t("timelines.item.period", { title, start, end });
}

/** The view a timeline opens on: all its items, else its eras' meeting or a century from 0. */
function initialView(calendar: WorldCalendar, timeline: Timeline, width: number): Viewport {
  const span = extent(calendar, timeline.items);
  // On the right, room for the names of the last items.
  if (span) return frame(span.from, span.to, width, 48, Math.min(220, width / 4));
  const year = calendar.months.reduce((sum, month) => sum + month.days, 0) || 1;
  return frame(-10 * year, 100 * year, width);
}

/**
 * A timeline drawn horizontally (docs/features/09-frise.md): the graduation
 * of the world's calendar, its eras as bands, its tracks with their events
 * (markers) and periods (bars). Wheel pans, Ctrl + wheel zooms around the
 * pointer, a drag pans; arrows, + and − do the same from the keyboard.
 */
export const TimelineView = forwardRef<TimelineViewHandle, Props>(function TimelineView(
  { timeline, calendar, cardsById, label, selectedId, onSelect },
  ref,
) {
  const { t } = useTranslation();
  const words = useCalendarWords();
  const hintId = useId();
  const area = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [view, setView] = useState<Viewport | null>(null);

  // The width of the drawing; the first one frames the timeline.
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry?.contentRect.width ?? 0);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (width > 0 && view === null) setView(initialView(calendar, timeline, width));
  }, [width, view, calendar, timeline]);

  const fitAll = useCallback(() => {
    if (width > 0) setView(initialView(calendar, timeline, width));
  }, [calendar, timeline, width]);

  useImperativeHandle(
    ref,
    () => ({
      fitAll,
      zoom: (factor) => setView((current) => current && zoomAt(current, factor, width / 2)),
      goTo: (day, precision) =>
        setView((current) => {
          if (!current) return current;
          const least = precision === "day" ? 40 : precision === "month" ? 2 : current.scale;
          const scale = clampScale(Math.max(current.scale, least));
          return centerOn({ ...current, scale }, day, width);
        }),
      center: () => (view ? view.start + width / 2 / view.scale : 0),
    }),
    [fitAll, width, view],
  );

  // Wheel: pans; with Ctrl, zooms around the pointer. Not passive, to keep the page still.
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const x = event.clientX - element.getBoundingClientRect().left;
      setView((current) => {
        if (!current) return current;
        if (event.ctrlKey || event.metaKey) {
          return zoomAt(current, Math.exp(-event.deltaY * 0.0015), x);
        }
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        return { ...current, start: current.start + delta / current.scale };
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  // A drag on the background pans; a click there (no drag) clears the selection.
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as Element).closest("button")) return;
    drag.current = { x: event.clientX, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    if (!current.moved && Math.abs(dx) < 3) return;
    current.moved = true;
    current.x = event.clientX;
    setView((latest) => latest && { ...latest, start: latest.start - dx / latest.scale });
  };
  const onPointerUp = () => {
    if (drag.current && !drag.current.moved) onSelect(null);
    drag.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!view) return;
    const pan = (share: number) =>
      setView({ ...view, start: view.start + (share * width) / view.scale });
    const step = event.shiftKey ? PAN_STEP * 4 : PAN_STEP;
    if (event.key === "ArrowLeft") pan(-step);
    else if (event.key === "ArrowRight") pan(step);
    else if (event.key === "+" || event.key === "=") setView(zoomAt(view, ZOOM_STEP, width / 2));
    else if (event.key === "-") setView(zoomAt(view, 1 / ZOOM_STEP, width / 2));
    else if (event.key === "0") fitAll();
    else if (event.key === "Escape" && selectedId) onSelect(null);
    else return;
    event.preventDefault();
  };

  // A focused item out of sight (Tab) comes into the middle.
  const reveal = (item: TimelineItem) => {
    if (area.current) area.current.scrollLeft = 0;
    if (!view) return;
    const x = xOf(view, item.start);
    if (x < 0 || x > width - 40) setView(centerOn(view, item.start, width));
  };

  const scale = view?.scale ?? 1;
  const bands = useMemo(() => eraBands(calendar), [calendar]);
  const graduation = useMemo(
    () => (view && width > 0 ? ticks(calendar, view, width, words) : []),
    [calendar, view, width, words],
  );

  const written = useMemo(
    () => (view ? labelled(graduation, (day) => xOf(view, day)) : new Set<number>()),
    [graduation, view],
  );

  // Lanes only change with the scale (positions relative to day 0).
  const layout = useMemo(() => {
    const byTrack = new Map<string, TimelineItem[]>();
    for (const item of timeline.items) {
      const list = byTrack.get(item.trackId) ?? [];
      list.push(item);
      byTrack.set(item.trackId, list);
    }
    const laneOf = new Map<string, number>();
    const height = new Map<string, number>();
    for (const track of timeline.tracks) {
      const items = byTrack.get(track.id) ?? [];
      const result = lanes(items, (item) => {
        const left = item.start * scale;
        const bar = item.end === null ? 0 : (itemEnd(calendar, item) + 1 - item.start) * scale;
        const card = item.cardId ? cardsById.get(item.cardId) : undefined;
        const text = itemTitle(item, card).length * 7 + (card?.imageAssetId ? 26 : 0) + 30;
        return { left: left - 8, right: left + Math.max(bar, text) + 8 };
      });
      let most = 0;
      for (const [id, lane] of result) {
        laneOf.set(id, lane);
        most = Math.max(most, lane + 1);
      }
      height.set(track.id, Math.max(1, most) * LANE_H + 2 * TRACK_PAD);
    }
    return { byTrack, laneOf, height };
  }, [timeline, calendar, cardsById, scale]);

  const clampX = (x: number) => Math.min(Math.max(x, -BLEED), width + BLEED);

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-background/40">
      <div className="flex min-h-full w-full">
        {/* Track names, beside their rows. */}
        <div className="sticky left-0 z-20 w-40 shrink-0 border-r border-border bg-background/85 backdrop-blur">
          <div
            className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur"
            style={{ height: RULER_H }}
          />
          {timeline.tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-start gap-2 border-b border-border px-3 pt-3 text-sm font-medium"
              style={{ height: layout.height.get(track.id) }}
            >
              <span
                aria-hidden
                className="mt-1.5 size-2 shrink-0 rounded-full"
                style={{ backgroundColor: typeColor(track.color) }}
              />
              <span className="min-w-0 break-words">{track.name}</span>
            </div>
          ))}
        </div>
        <div
          ref={area}
          role="application"
          aria-roledescription={t("timelines.roleDescription")}
          aria-label={label}
          aria-describedby={hintId}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the drawing takes the keys that move it
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
          }}
          className="relative min-w-0 flex-1 cursor-grab touch-none overflow-x-clip outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:cursor-grabbing"
        >
          <p id={hintId} className="sr-only">
            {t("timelines.keysHint")}
          </p>
          {view && (
            <>
              {/* Eras and ticks, behind everything. */}
              <div aria-hidden className="pointer-events-none absolute inset-0">
                {bands.map((band, index) => {
                  const left = clampX(xOf(view, band.from));
                  const right = band.to === null ? width + BLEED : clampX(xOf(view, band.to + 1));
                  if (right < 0 || left > width) return null;
                  return (
                    <div
                      key={band.era.startYear}
                      className={cn(
                        "absolute inset-y-0 border-l border-primary/30",
                        index % 2 === 0 ? "bg-primary/[0.05]" : "bg-transparent",
                      )}
                      style={{ left, width: Math.max(0, right - left) }}
                    />
                  );
                })}
                {graduation.map((tick) => (
                  <div
                    key={tick.day}
                    className={cn(
                      "absolute inset-y-0 w-px",
                      tick.major ? "bg-border" : "bg-border/50",
                    )}
                    style={{ left: xOf(view, tick.day) }}
                  />
                ))}
              </div>

              {/* The ruler: ticks' labels, then eras' names. */}
              <div
                aria-hidden
                className="sticky top-0 z-10 overflow-hidden border-b border-border bg-background/85 backdrop-blur"
                style={{ height: RULER_H }}
              >
                {graduation.map((tick) =>
                  !written.has(tick.day) ? null : (
                    <span
                      key={tick.day}
                      className={cn(
                        "absolute top-1.5 pl-1 text-xs whitespace-nowrap tabular-nums",
                        tick.major ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                      style={{ left: xOf(view, tick.day) }}
                    >
                      {tick.label}
                    </span>
                  ),
                )}
                {bands.map((band) => {
                  const left = xOf(view, band.from);
                  const right =
                    band.to === null ? Number.POSITIVE_INFINITY : xOf(view, band.to + 1);
                  if (right < 0 || left > width) return null;
                  return (
                    <span
                      key={band.era.startYear}
                      className="absolute bottom-1.5 truncate pl-1.5 text-xs font-semibold text-primary"
                      style={{
                        left: Math.max(left, 0),
                        maxWidth: Math.max(0, Math.min(right, width) - Math.max(left, 0)),
                      }}
                    >
                      {band.era.name || band.era.abbreviation}
                    </span>
                  );
                })}
              </div>

              {timeline.tracks.map((track) => (
                <ul
                  key={track.id}
                  aria-label={track.name}
                  className="relative border-b border-border"
                  style={{ height: layout.height.get(track.id) }}
                >
                  {(layout.byTrack.get(track.id) ?? []).map((item) => {
                    const card = item.cardId ? cardsById.get(item.cardId) : undefined;
                    const title = itemTitle(item, card);
                    const x0 = xOf(view, item.start);
                    const x1 = xOf(view, itemEnd(calendar, item) + 1);
                    const top = TRACK_PAD + (layout.laneOf.get(item.id) ?? 0) * LANE_H;
                    return (
                      <li key={item.id} className="contents">
                        <ItemButton
                          item={item}
                          title={title}
                          card={card}
                          label={itemLabel(t, calendar, words, item, title)}
                          left={clampX(x0)}
                          right={clampX(x1)}
                          top={top}
                          selected={item.id === selectedId}
                          onSelect={() => onSelect(item.id)}
                          onFocus={() => reveal(item)}
                        />
                      </li>
                    );
                  })}
                </ul>
              ))}
            </>
          )}
          {timeline.items.length === 0 && (
            <p className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-sm text-muted-foreground">
              {t("timelines.empty")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

type ItemButtonProps = {
  item: TimelineItem;
  title: string;
  card: Card | undefined;
  label: string;
  left: number;
  right: number;
  top: number;
  selected: boolean;
  onSelect: () => void;
  onFocus: () => void;
};

/** An event (a marker and its name) or a period (a bar holding its name). */
function ItemButton({
  item,
  title,
  card,
  label,
  left,
  right,
  top,
  selected,
  onSelect,
  onFocus,
}: ItemButtonProps) {
  const color = typeColor(item.color);
  const style = { "--item": color, top, height: LANE_H - 6 } as CSSProperties;
  const avatar = card?.imageAssetId ? (
    <AssetImage
      assetId={card.imageAssetId}
      alt=""
      className="size-5 shrink-0 rounded-full object-cover ring-1 ring-background"
    />
  ) : null;
  const common = cn(
    "absolute flex items-center gap-1.5 rounded-md text-xs whitespace-nowrap outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring",
    selected && "ring-2 ring-ring",
  );
  if (item.end === null) {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        title={label}
        onClick={onSelect}
        onFocus={onFocus}
        className={cn(common, "-translate-x-2 pr-2 pl-0.5 hover:bg-accent/60")}
        style={{ ...style, left }}
      >
        <span
          aria-hidden
          className="size-3 shrink-0 rotate-45 rounded-[2px] border border-background bg-[var(--item)] shadow-sm"
        />
        {avatar}
        <span className="font-medium">{title}</span>
      </button>
    );
  }
  const width = Math.max(6, right - left);
  // The name stays in sight while the bar starts off the view.
  const inset = Math.max(0, Math.min(-left, width - 40));
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onSelect}
      onFocus={onFocus}
      className={cn(
        common,
        "border border-[color-mix(in_oklab,var(--item)_55%,transparent)] border-l-[3px] border-l-[var(--item)]",
        "bg-[color-mix(in_oklab,var(--item)_22%,transparent)] hover:bg-[color-mix(in_oklab,var(--item)_32%,transparent)]",
      )}
      style={{ ...style, left, width }}
    >
      <span className="flex min-w-0 items-center gap-1.5 px-1.5" style={{ marginLeft: inset }}>
        {avatar}
        <span className="font-medium">{title}</span>
      </span>
    </button>
  );
}
