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
import {
  CARD_DRAG_EVENT,
  CARD_DROP_EVENT,
  type CardDragDetail,
  type CardDropDetail,
} from "@/lib/cardDrop";
import { cn } from "@/lib/utils";
import { type CalendarWords, formatDate } from "../calendar";
import { moveItem, snapDay, stepOf, stretchItem, unitsIn } from "../edit";
import {
  centerOn,
  clampScale,
  dayAt,
  eraBands,
  extent,
  frame,
  itemEnd,
  labelled,
  lanes,
  ticks,
  tickUnit,
  unitPrecision,
  type Viewport,
  xOf,
  zoomAt,
} from "../scale";
import { useCalendarWords } from "../useCalendar";

/** Height of the ruler (ticks, then eras), of a lane, and a track's padding. */
const RULER_H = 48;
const LANE_H = 34;
const TRACK_PAD = 10;
/** The axis view (vvd's): a bubble's height and the gap between its levels. */
const BUBBLE_H = 28;
const LEVEL_GAP = 36;
/** Below the axis: the graduation's labels. */
const AXIS_FOOT = 64;
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
  /** What the graduation counts in: where new items snap. */
  unit: () => DatePrecision;
};

type Props = {
  timeline: Timeline;
  calendar: WorldCalendar;
  cardsById: ReadonlyMap<string, Card>;
  /** Its accessible name. */
  label: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** An item dragged, stretched or moved by keys (11.4); without it, items stay put. */
  onChange?: (item: TimelineItem) => void;
  /** A double click on a track: a new event there. */
  onCreate?: (trackId: string, day: number, precision: DatePrecision) => void;
  onDelete?: (id: string) => void;
  /** A double click on an item (one standing for a card opens it). */
  onOpen?: (item: TimelineItem) => void;
  /** The item the view centres on, at first and whenever it changes. */
  focusId?: string | null;
  /** Inside a card: the wheel scrolls the card, Ctrl + wheel zooms. */
  embedded?: boolean;
  /**
   * « axis » (vvd's look, the default): one axis, events as dots with their
   * names in bubbles above; « tracks »: one row per track.
   */
  mode?: "axis" | "tracks";
  /** Items left out by the tag filter: shown faded. */
  dimmedIds?: ReadonlySet<string> | undefined;
  /**
   * The half of the view the selected item is in: the page puts the item's
   * card on the other side, so it never hides the item.
   */
  onSelectedSide?: (side: "left" | "right") => void;
  /**
   * A card of the sidebar dropped on the timeline: the day under it (snapped
   * to the visible unit) and, in the track view, the track under it.
   */
  onCardDrop?: (
    cardId: string,
    day: number,
    precision: DatePrecision,
    trackId: string | null,
  ) => void;
};

/** A drag of an item: what is held and from where. */
type ItemDrag = {
  item: TimelineItem;
  edge: "move" | "start" | "end";
  x: number;
  y: number;
  moved: boolean;
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
  // Room for the names of the first and last items (bubbles are centred on them).
  if (span)
    return frame(span.from, span.to, width, Math.min(140, width / 6), Math.min(220, width / 4));
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
  {
    timeline,
    calendar,
    cardsById,
    label,
    selectedId,
    onSelect,
    onChange,
    onCreate,
    onDelete,
    onOpen,
    focusId = null,
    embedded = false,
    mode = "axis",
    dimmedIds,
    onSelectedSide,
    onCardDrop,
  },
  ref,
) {
  const { t } = useTranslation();
  const words = useCalendarWords();
  const hintId = useId();
  const area = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [view, setView] = useState<Viewport | null>(null);

  // The width of the drawing; the first one frames the timeline.
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry?.contentRect.width ?? 0);
      if (next > 0) setWidth(next);
      setHeight(Math.round(entry?.contentRect.height ?? 0));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // The item to show, centred: at first, then each time another is asked for.
  const focused = useRef<string | null>(null);
  useEffect(() => {
    if (width <= 0) return;
    const item = focusId ? timeline.items.find((each) => each.id === focusId) : undefined;
    if (view !== null && (!item || focused.current === focusId)) return;
    focused.current = focusId;
    const base = view ?? initialView(calendar, timeline, width);
    setView(item ? centerOn(base, (item.start + itemEnd(calendar, item) + 1) / 2, width) : base);
  }, [width, view, calendar, timeline, focusId]);

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
      unit: () => unitPrecision(tickUnit(calendar, view?.scale ?? 1)),
    }),
    [fitAll, width, view, calendar],
  );

  // Wheel: pans; with Ctrl, zooms around the pointer. Not passive, to keep the page still.
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      // In a card, the wheel alone scrolls the card.
      if (embedded && !(event.ctrlKey || event.metaKey)) return;
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
  }, [embedded]);

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

  // Items are dragged (moved, or a period stretched by an edge), across tracks too.
  const visibleUnit = unitPrecision(tickUnit(calendar, view?.scale ?? 1));
  const [draft, setDraft] = useState<TimelineItem | null>(null);
  const itemDrag = useRef<ItemDrag | null>(null);
  const skipClick = useRef(false);
  const latest = useRef({ calendar, view, visibleUnit, onChange });
  latest.current = { calendar, view, visibleUnit, onChange };

  const onItemPointerDown = (event: PointerEvent<HTMLElement>, item: TimelineItem) => {
    if (event.button !== 0 || !onChange) return;
    const handle = (event.target as Element).closest<HTMLElement>("[data-edge]")?.dataset.edge;
    itemDrag.current = {
      item,
      edge: handle === "start" || handle === "end" ? handle : "move",
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    let landing: TimelineItem | null = null;
    const onMove = (move: globalThis.PointerEvent) => {
      const current = itemDrag.current;
      const { calendar: cal, view: shown, visibleUnit: unit } = latest.current;
      if (!current || !shown) return;
      const dx = move.clientX - current.x;
      // A move may go up or down to another track; a stretch only sideways.
      const dy = current.edge === "move" ? move.clientY - current.y : 0;
      if (!current.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      current.moved = true;
      const step = stepOf(unit, current.item.precision);
      const count = unitsIn(cal, dx, shown.scale, step);
      let next =
        current.edge === "move"
          ? moveItem(cal, current.item, step, count)
          : stretchItem(cal, current.item, current.edge, step, count);
      if (current.edge === "move") {
        const row = document
          .elementsFromPoint?.(move.clientX, move.clientY)
          .find((element) => element instanceof HTMLElement && element.dataset.trackId);
        const trackId = row instanceof HTMLElement ? row.dataset.trackId : undefined;
        if (trackId) next = { ...next, trackId };
      }
      landing = next;
      setDraft(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const current = itemDrag.current;
      itemDrag.current = null;
      setDraft(null);
      if (!current?.moved) return;
      // The click ending a drag selects nothing.
      skipClick.current = true;
      if (
        landing &&
        (landing.start !== current.item.start ||
          landing.end !== current.item.end ||
          landing.trackId !== current.item.trackId)
      ) {
        latest.current.onChange?.(landing);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  /**
   * Alt + left/right move the item by a unit (with Shift, stretch its end);
   * Alt + up/down move it to the track above or below; Delete removes it.
   */
  const onItemKeyDown = (event: KeyboardEvent<HTMLButtonElement>, item: TimelineItem) => {
    if (!onChange) return;
    const step = stepOf(visibleUnit, item.precision);
    const index = timeline.tracks.findIndex((track) => track.id === item.trackId);
    let next: TimelineItem | null = null;
    if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      const count = event.key === "ArrowLeft" ? -1 : 1;
      next = event.shiftKey
        ? stretchItem(calendar, item, "end", step, count)
        : moveItem(calendar, item, step, count);
    } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      const track = timeline.tracks[index + (event.key === "ArrowUp" ? -1 : 1)];
      if (track) next = { ...item, trackId: track.id };
    } else if ((event.key === "Delete" || event.key === "Backspace") && onDelete) {
      event.preventDefault();
      event.stopPropagation();
      onDelete(item.id);
      return;
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (next && next !== item) onChange(next);
  };

  /**
   * A double click on a track adds an event there. Heard on the drawing: its
   * pointer capture (the pan) sends the clicks to it, so the track is the
   * one under the pointer.
   */
  const onDoubleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!onCreate || !view || !area.current || (event.target as Element).closest("button")) return;
    const under = document.elementsFromPoint?.(event.clientX, event.clientY) ?? [
      event.target as Element,
    ];
    const row = [event.target as Element, ...under]
      .map((element) => element.closest<HTMLElement>("[data-track-id]"))
      .find((element) => element !== null);
    const trackId = row?.dataset.trackId;
    if (!trackId) return;
    const x = event.clientX - area.current.getBoundingClientRect().left;
    onCreate(trackId, snapDay(calendar, dayAt(view, x), visibleUnit), visibleUnit);
  };

  // A card dragged from the sidebar and dropped here (DocumentTreeView).
  const dropTarget = useRef({ view, calendar, visibleUnit, onCardDrop });
  dropTarget.current = { view, calendar, visibleUnit, onCardDrop };
  useEffect(() => {
    const onDrop = (event: Event) => {
      const { cardId, clientX, clientY } = (event as CustomEvent<CardDropDetail>).detail;
      const {
        view: shown,
        calendar: cal,
        visibleUnit: unit,
        onCardDrop: drop,
      } = dropTarget.current;
      const element = area.current;
      if (!element || !shown || !drop) return;
      const box = element.getBoundingClientRect();
      if (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom) {
        return;
      }
      const row = document
        .elementsFromPoint?.(clientX, clientY)
        .find((each) => each instanceof HTMLElement && each.dataset.trackId);
      const trackId = row instanceof HTMLElement ? (row.dataset.trackId ?? null) : null;
      drop(cardId, snapDay(cal, dayAt(shown, clientX - box.left), unit), unit, trackId);
    };
    window.addEventListener(CARD_DROP_EVENT, onDrop);
    return () => window.removeEventListener(CARD_DROP_EVENT, onDrop);
  }, []);

  // While a card is dragged over the timeline: where it would land.
  const [guide, setGuide] = useState<{ x: number; day: number } | null>(null);
  useEffect(() => {
    const onDrag = (event: Event) => {
      const detail = (event as CustomEvent<CardDragDetail>).detail;
      const {
        view: shown,
        calendar: cal,
        visibleUnit: unit,
        onCardDrop: drop,
      } = dropTarget.current;
      const element = area.current;
      if (!detail || !element || !shown || !drop) {
        setGuide(null);
        return;
      }
      const box = element.getBoundingClientRect();
      const inside =
        detail.clientX >= box.left &&
        detail.clientX <= box.right &&
        detail.clientY >= box.top &&
        detail.clientY <= box.bottom;
      if (!inside) {
        setGuide(null);
        return;
      }
      const day = snapDay(cal, dayAt(shown, detail.clientX - box.left), unit);
      setGuide({ x: xOf(shown, day), day });
    };
    window.addEventListener(CARD_DRAG_EVENT, onDrag);
    return () => window.removeEventListener(CARD_DRAG_EVENT, onDrag);
  }, []);
  const dropGuide = guide ? (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 z-[15] border-l-2 border-dashed border-primary"
      style={{ left: guide.x }}
    >
      <span className="absolute top-2 left-1.5 rounded-full bg-primary px-2 py-0.5 text-xs font-medium whitespace-nowrap text-primary-foreground shadow">
        {formatDate(calendar, guide.day, visibleUnit, words)}
      </span>
    </div>
  ) : null;

  // A focused item out of sight (Tab) comes into the middle.
  const reveal = (item: TimelineItem) => {
    if (area.current) area.current.scrollLeft = 0;
    if (!view) return;
    const x = xOf(view, item.start);
    if (x < 0 || x > width - 40) setView(centerOn(view, item.start, width));
  };

  const selectedItem = selectedId
    ? timeline.items.find((item) => item.id === selectedId)
    : undefined;
  const selectedSide =
    view && selectedItem && xOf(view, selectedItem.start) > width / 2 ? "right" : "left";
  useEffect(() => {
    onSelectedSide?.(selectedSide);
  }, [onSelectedSide, selectedSide]);

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
  // The item being dragged shows where it would land.
  const shown = useMemo(
    () =>
      draft ? timeline.items.map((item) => (item.id === draft.id ? draft : item)) : timeline.items,
    [timeline.items, draft],
  );
  const layout = useMemo(() => {
    const byTrack = new Map<string, TimelineItem[]>();
    for (const item of shown) {
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
  }, [timeline.tracks, shown, calendar, cardsById, scale]);

  const clampX = (x: number) => Math.min(Math.max(x, -BLEED), width + BLEED);

  // The axis view: each bubble on the first level where it runs into no other.
  const axis = useMemo(() => {
    if (mode !== "axis") return null;
    const levelOf = lanes(shown, (item) => {
      const card = item.cardId ? cardsById.get(item.cardId) : undefined;
      const text = itemTitle(item, card).length * 7 + (card?.imageAssetId ? 26 : 0) + 34;
      const at = item.start * scale;
      return { left: at - text / 2 - 6, right: at + text / 2 + 6 };
    });
    let levels = 1;
    for (const level of levelOf.values()) levels = Math.max(levels, level + 1);
    return { levelOf, levels };
  }, [mode, shown, cardsById, scale]);

  const itemProps = (item: TimelineItem) => {
    const card = item.cardId ? cardsById.get(item.cardId) : undefined;
    const title = itemTitle(item, card);
    return {
      item,
      title,
      card,
      label: itemLabel(t, calendar, words, item, title),
      selected: item.id === selectedId,
      dragging: item.id === draft?.id,
      editable: Boolean(onChange),
      dimmed: dimmedIds?.has(item.id) ?? false,
      onSelect: () => {
        // The click ending a drag selects nothing.
        if (skipClick.current) {
          skipClick.current = false;
          return;
        }
        onSelect(item.id);
      },
      onFocus: () => reveal(item),
      onPointerDown: (event: PointerEvent<HTMLElement>) => onItemPointerDown(event, item),
      onDoubleClick: () => onOpen?.(item),
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => onItemKeyDown(event, item),
    };
  };

  const drawingProps = {
    ref: area,
    role: "application",
    "aria-roledescription": t("timelines.roleDescription"),
    "aria-label": label,
    "aria-describedby": hintId,
    tabIndex: 0,
    onKeyDown,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDoubleClick,
    onPointerCancel: () => {
      drag.current = null;
    },
  } as const;

  if (axis) {
    // The axis sits low enough for every level of bubbles above it.
    const axisY = Math.max(Math.round(height * 0.58), 48 + axis.levels * LEVEL_GAP + BUBBLE_H);
    return (
      <div className="timeline-dots relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-lg border border-border/60">
        <div
          {...drawingProps}
          className="relative h-full min-h-full cursor-grab touch-none overflow-x-clip outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:cursor-grabbing"
          style={{ minHeight: axisY + AXIS_FOOT }}
        >
          <p id={hintId} className="sr-only">
            {t("timelines.keysHint")}
          </p>
          {view && (
            <>
              {/* Eras: soft bands, named at their visible start when there is room. */}
              <div aria-hidden className="pointer-events-none absolute inset-0">
                {bands.map((band, index) => {
                  const left = clampX(xOf(view, band.from));
                  const right = band.to === null ? width + BLEED : clampX(xOf(view, band.to + 1));
                  if (right < 0 || left > width) return null;
                  const shown = Math.min(right, width) - Math.max(left, 0);
                  const name = band.era.name || band.era.abbreviation;
                  return (
                    <div key={band.era.startYear}>
                      <div
                        className={cn(
                          "absolute inset-y-0 border-l border-primary/25",
                          index % 2 === 0 ? "bg-primary/[0.04]" : "bg-transparent",
                        )}
                        style={{ left, width: Math.max(0, right - left) }}
                      />
                      {shown > 48 && (
                        <span
                          className="absolute top-2 truncate px-2 text-xs font-semibold text-primary"
                          style={{ left: Math.max(left, 0), maxWidth: shown }}
                        >
                          {name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* The axis and its graduation. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0"
                style={{ top: axisY }}
              >
                <div className="absolute inset-x-0 h-px bg-foreground/35" />
                {graduation.map((tick) => (
                  <div key={tick.day} className="absolute" style={{ left: xOf(view, tick.day) }}>
                    <div
                      className={cn(
                        "absolute -top-1 w-px",
                        tick.major ? "h-3 bg-foreground/55" : "h-2 bg-foreground/35",
                      )}
                    />
                    {written.has(tick.day) && (
                      <span
                        className={cn(
                          "absolute top-4 -translate-x-1/2 text-xs whitespace-nowrap tabular-nums",
                          tick.major ? "font-medium text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {tick.label}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <ul aria-label={label} className="contents">
                {shown.map((item) => {
                  const x0 = xOf(view, item.start);
                  const x1 = xOf(view, itemEnd(calendar, item) + 1);
                  const level = axis.levelOf.get(item.id) ?? 0;
                  return (
                    <li key={item.id} className="contents">
                      <AxisItem
                        {...itemProps(item)}
                        x={clampX(x0)}
                        end={item.end === null ? null : clampX(x1)}
                        axisY={axisY}
                        bubbleY={axisY - 22 - level * LEVEL_GAP - BUBBLE_H}
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {dropGuide}
          {timeline.items.length === 0 && (
            <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-muted-foreground">
              {t("timelines.empty")}
            </p>
          )}
        </div>
      </div>
    );
  }

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
          {...drawingProps}
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
                  data-track-id={track.id}
                  className="relative border-b border-border"
                  style={{ height: layout.height.get(track.id) }}
                >
                  {(layout.byTrack.get(track.id) ?? []).map((item) => {
                    const x0 = xOf(view, item.start);
                    const x1 = xOf(view, itemEnd(calendar, item) + 1);
                    const top = TRACK_PAD + (layout.laneOf.get(item.id) ?? 0) * LANE_H;
                    return (
                      <li key={item.id} className="contents">
                        <ItemButton
                          {...itemProps(item)}
                          left={clampX(x0)}
                          right={clampX(x1)}
                          top={top}
                        />
                      </li>
                    );
                  })}
                </ul>
              ))}
            </>
          )}
          {dropGuide}
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

type ItemProps = {
  item: TimelineItem;
  title: string;
  card: Card | undefined;
  label: string;
  selected: boolean;
  dragging: boolean;
  editable: boolean;
  /** Left out by the tag filter. */
  dimmed: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onDoubleClick: () => void;
};

type ItemButtonProps = ItemProps & { left: number; right: number; top: number };

/**
 * An item on the axis: a dot (a period, a thick segment along the axis)
 * and its name in a bubble above, joined by a stem. The bubble is the
 * button; the segment's ends stretch the period.
 */
function AxisItem({
  item,
  title,
  card,
  label,
  selected,
  dragging,
  editable,
  dimmed,
  onSelect,
  onFocus,
  onPointerDown,
  onKeyDown,
  onDoubleClick,
  x,
  end,
  axisY,
  bubbleY,
}: ItemProps & { x: number; end: number | null; axisY: number; bubbleY: number }) {
  const style = { "--item": typeColor(item.color) } as CSSProperties;
  return (
    <div className={cn("contents", dimmed && "[&>*]:opacity-30")} style={style}>
      {end !== null && (
        <div
          aria-hidden
          onPointerDown={onPointerDown}
          className={cn(
            "absolute h-1.5 -translate-y-1/2 rounded-full bg-[var(--item)]",
            editable && "cursor-grab",
          )}
          style={{ left: x, top: axisY, width: Math.max(6, end - x), ...style }}
        >
          {editable && (
            <>
              <span
                data-edge="start"
                className="absolute -inset-y-2 -left-1.5 w-3 cursor-ew-resize"
              />
              <span
                data-edge="end"
                className="absolute -inset-y-2 -right-1.5 w-3 cursor-ew-resize"
              />
            </>
          )}
        </div>
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute z-0 w-px bg-foreground/25"
        style={{
          left: x,
          top: bubbleY + BUBBLE_H,
          height: Math.max(0, axisY - bubbleY - BUBBLE_H),
        }}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-[var(--item)] shadow-sm",
          selected && "ring-2 ring-ring",
        )}
        style={{ left: x, top: axisY, ...style }}
      />
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        title={label}
        onClick={onSelect}
        onFocus={onFocus}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onDoubleClick={onDoubleClick}
        className={cn(
          "absolute z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap shadow-sm outline-none backdrop-blur",
          "border-border bg-background/90 text-foreground hover:bg-background",
          "focus-visible:ring-2 focus-visible:ring-ring",
          selected && "border-transparent bg-foreground text-background hover:bg-foreground",
          editable && "cursor-grab",
          dragging && "z-20 cursor-grabbing shadow-lg",
        )}
        style={{ left: x, top: bubbleY, height: BUBBLE_H, ...style }}
      >
        {card?.imageAssetId || item.imageAssetId ? (
          <AssetImage
            assetId={(item.imageAssetId ?? card?.imageAssetId) as string}
            alt=""
            className="-ml-2 size-5 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--item)]" />
        )}
        {title}
      </button>
    </div>
  );
}

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
  dragging,
  editable,
  dimmed,
  onSelect,
  onFocus,
  onPointerDown,
  onKeyDown,
  onDoubleClick,
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
    editable && "cursor-grab",
    dragging && "z-10 cursor-grabbing opacity-90 shadow-lg",
    dimmed && "opacity-30",
  );
  const handlers = { onClick: onSelect, onFocus, onPointerDown, onKeyDown, onDoubleClick };
  if (item.end === null) {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        title={label}
        {...handlers}
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
      {...handlers}
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
      {editable && (
        <>
          {/* The edges stretch the period. */}
          <span
            aria-hidden
            data-edge="start"
            className="absolute inset-y-0 -left-1 w-2.5 cursor-ew-resize"
          />
          <span
            aria-hidden
            data-edge="end"
            className="absolute inset-y-0 -right-1 w-2.5 cursor-ew-resize"
          />
        </>
      )}
    </button>
  );
}
