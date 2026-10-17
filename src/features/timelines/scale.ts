import type { DatePrecision, Era, TimelineItem, WorldCalendar } from "@/lib/bindings";
import {
  type CalendarWords,
  formatDate,
  fromDays,
  lastDay,
  monthName,
  toDays,
  yearLength,
} from "./calendar";

/**
 * What a timeline shows (docs/features/09-frise.md): the day at its left
 * edge and its scale, in pixels per day. Days are counted from the year 0.
 */
export type Viewport = { start: number; scale: number };

/** Ten days fill a wide screen at most; a million years fit in a few pixels at least. */
export const MAX_SCALE = 120;
export const MIN_SCALE = 1e-7;

export function clampScale(scale: number): number {
  return Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);
}

export function xOf(view: Viewport, day: number): number {
  return (day - view.start) * view.scale;
}

export function dayAt(view: Viewport, x: number): number {
  return view.start + x / view.scale;
}

/** Zooms by `factor` keeping the day under `x` (the pointer) where it is. */
export function zoomAt(view: Viewport, factor: number, x: number): Viewport {
  const scale = clampScale(view.scale * factor);
  return { scale, start: dayAt(view, x) - x / scale };
}

/** Puts `day` in the middle of a view `width` wide. */
export function centerOn(view: Viewport, day: number, width: number): Viewport {
  return { ...view, start: day - width / 2 / view.scale };
}

/**
 * Frames the days `from`..`to` (both shown) with `left` and `right` pixels
 * around them (room for the last items' names on the right).
 */
export function frame(from: number, to: number, width: number, left = 48, right = left): Viewport {
  const span = Math.max(1, to - from + 1);
  const scale = clampScale(Math.max(1, width - left - right) / span);
  return { scale, start: from - left / scale };
}

/** The last day an item covers (its date's last day for an event). */
export function itemEnd(calendar: WorldCalendar, item: TimelineItem): number {
  return lastDay(calendar, fromDays(calendar, item.end ?? item.start), item.precision);
}

/** The days a timeline's items cover, or null when it has none. */
export function extent(
  calendar: WorldCalendar,
  items: readonly TimelineItem[],
): { from: number; to: number } | null {
  if (items.length === 0) return null;
  let from = Number.POSITIVE_INFINITY;
  let to = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    from = Math.min(from, item.start);
    to = Math.max(to, itemEnd(calendar, item));
  }
  return { from, to };
}

export type Tick = { day: number; label: string; major: boolean };

/** Steps of the graduation in years, the smallest first. */
const YEAR_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
/** Steps in days within a month. */
const DAY_STEPS = [1, 2, 5, 10];
/** The narrowest gap between two labelled ticks, in pixels. */
const MIN_GAP = 84;
/** No graduation draws more ticks than this. */
const MAX_TICKS = 400;

/** The unit the graduation counts in at this scale: also what a drag snaps to. */
export type TickUnit =
  | { kind: "year"; step: number }
  | { kind: "month" }
  | { kind: "day"; step: number };

export function tickUnit(calendar: WorldCalendar, scale: number): TickUnit {
  const months = Math.max(1, calendar.months.length);
  const shortestMonth = Math.min(...calendar.months.map((month) => month.days), 30);
  for (const step of DAY_STEPS) {
    if (step * scale >= MIN_GAP / 2 && step <= shortestMonth) return { kind: "day", step };
  }
  if ((yearLength(calendar) / months) * scale >= MIN_GAP) return { kind: "month" };
  const year = yearLength(calendar) * scale;
  for (const step of YEAR_STEPS) {
    if (step * year >= MIN_GAP) return { kind: "year", step };
  }
  // Beyond the list: powers of ten.
  let step = 10_000;
  while (step * year < MIN_GAP) step *= 10;
  return { kind: "year", step };
}

/** What a tick unit names, as a date precision. */
export function unitPrecision(unit: TickUnit): DatePrecision {
  return unit.kind === "day" ? "day" : unit.kind === "month" ? "month" : "year";
}

/** The graduation of the days `from`..`to`, in the world's calendar and words. */
export function ticks(
  calendar: WorldCalendar,
  view: Viewport,
  width: number,
  words: CalendarWords,
): Tick[] {
  const from = dayAt(view, 0);
  const to = dayAt(view, width);
  const unit = tickUnit(calendar, view.scale);
  const first = fromDays(calendar, Math.floor(from));
  const last = fromDays(calendar, Math.ceil(to));
  const result: Tick[] = [];
  const push = (tick: Tick) => {
    if (result.length < MAX_TICKS) result.push(tick);
  };
  if (unit.kind === "year") {
    const big = unit.step * 5;
    for (
      let year = Math.floor(first.year / unit.step) * unit.step;
      year <= last.year;
      year += unit.step
    ) {
      const day = toDays(calendar, { year });
      push({ day, label: formatDate(calendar, day, "year", words), major: year % big === 0 });
    }
    return result;
  }
  for (let year = first.year; year <= last.year; year++) {
    for (let month = 1; month <= calendar.months.length; month++) {
      const day = toDays(calendar, { year, month });
      if (unit.kind === "month") {
        if (day + (calendar.months[month - 1]?.days ?? 1) < from || day > to) continue;
        push({
          day,
          label:
            month === 1
              ? formatDate(calendar, day, "month", words)
              : monthName(calendar, month, words),
          major: month === 1,
        });
        continue;
      }
      const days = calendar.months[month - 1]?.days ?? 1;
      if (day + days < from || day > to) continue;
      for (
        let date = 1;
        date <= days;
        date += date === 1 && unit.step > 1 ? unit.step - 1 : unit.step
      ) {
        const at = day + date - 1;
        if (at < from - 1 || at > to + 1) continue;
        push({
          day: at,
          label: date === 1 ? formatDate(calendar, at, "month", words) : String(date),
          major: date === 1,
        });
      }
    }
  }
  return result;
}

/** Roughly how wide a tick's label is drawn, in pixels. */
const labelWidth = (label: string) => label.length * 7 + 12;

/**
 * The ticks whose label can be written without running into another: the
 * major ones first, then the others in the gaps left.
 */
export function labelled(graduation: readonly Tick[], x: (day: number) => number): Set<number> {
  const taken: { left: number; right: number }[] = [];
  const kept = new Set<number>();
  const order = [...graduation].sort((a, b) => Number(b.major) - Number(a.major));
  for (const tick of order) {
    const left = x(tick.day);
    const right = left + labelWidth(tick.label);
    if (taken.some((span) => left < span.right && right > span.left)) continue;
    taken.push({ left, right });
    kept.add(tick.day);
  }
  return kept;
}

/** An era as a band behind the tracks: from its first day to the day before the next. */
export type EraBand = { era: Era; from: number; to: number | null };

export function eraBands(calendar: WorldCalendar): EraBand[] {
  const eras = [...calendar.eras].sort((a, b) => a.startYear - b.startYear);
  return eras.map((era, index) => {
    const next = eras[index + 1];
    return {
      era,
      from: toDays(calendar, { year: era.startYear }),
      to: next ? toDays(calendar, { year: next.startYear }) - 1 : null,
    };
  });
}

/**
 * Lanes of a track: items that would overlap on screen (their bar or their
 * label) go on separate lanes, the first free one in time order.
 */
export function lanes(
  items: readonly TimelineItem[],
  span: (item: TimelineItem) => { left: number; right: number },
): Map<string, number> {
  const ends: number[] = [];
  const result = new Map<string, number>();
  const sorted = [...items].sort((a, b) => a.start - b.start);
  for (const item of sorted) {
    const { left, right } = span(item);
    let lane = ends.findIndex((end) => end <= left);
    if (lane === -1) {
      lane = ends.length;
      ends.push(right);
    } else {
      ends[lane] = right;
    }
    result.set(item.id, lane);
  }
  return result;
}
