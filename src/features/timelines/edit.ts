import type { DatePrecision, TimelineItem, WorldCalendar } from "@/lib/bindings";
import { fromDays, toDays } from "./calendar";

/**
 * Editing a timeline's items (docs/features/09-frise.md, 11.4): moves and
 * stretches go by whole units (years, months or days), so a date keeps its
 * month and day when it moves by years.
 */

const RANK: Record<DatePrecision, number> = { year: 0, month: 1, day: 2 };

/** The unit a drag moves an item by: the visible one, never finer than the item's date. */
export function stepOf(visible: DatePrecision, precision: DatePrecision): DatePrecision {
  return RANK[visible] < RANK[precision] ? visible : precision;
}

/** `day` moved by `count` units (a day of month past the month's end is kept to its last day). */
export function shiftDay(
  calendar: WorldCalendar,
  day: number,
  unit: DatePrecision,
  count: number,
): number {
  if (count === 0) return day;
  if (unit === "day") return day + count;
  const date = fromDays(calendar, day);
  if (unit === "year") return toDays(calendar, { ...date, year: date.year + count });
  const months = Math.max(1, calendar.months.length);
  const index = date.year * months + (date.month - 1) + count;
  const year = Math.floor(index / months);
  return toDays(calendar, { year, month: index - year * months + 1, day: date.day });
}

/** The item moved by `count` units, both its dates. */
export function moveItem(
  calendar: WorldCalendar,
  item: TimelineItem,
  unit: DatePrecision,
  count: number,
): TimelineItem {
  return {
    ...item,
    start: shiftDay(calendar, item.start, unit, count),
    end: item.end === null ? null : shiftDay(calendar, item.end, unit, count),
  };
}

/**
 * A period stretched at one end by `count` units; it keeps at least its
 * own length of one unit (an end never comes before the start).
 */
export function stretchItem(
  calendar: WorldCalendar,
  item: TimelineItem,
  edge: "start" | "end",
  unit: DatePrecision,
  count: number,
): TimelineItem {
  if (item.end === null) return item;
  if (edge === "start") {
    const start = shiftDay(calendar, item.start, unit, count);
    return start > item.end ? item : { ...item, start };
  }
  const end = shiftDay(calendar, item.end, unit, count);
  return end < item.start ? item : { ...item, end };
}

/** How many whole units a drag of `pixels` covers at `scale` pixels a day. */
export function unitsIn(
  calendar: WorldCalendar,
  pixels: number,
  scale: number,
  unit: DatePrecision,
): number {
  const year = calendar.months.reduce((sum, month) => sum + month.days, 0) || 1;
  const days =
    unit === "day" ? 1 : unit === "month" ? year / Math.max(1, calendar.months.length) : year;
  return Math.round(pixels / scale / days);
}

/** The first day of the unit holding `day` (where a new item lands). */
export function snapDay(calendar: WorldCalendar, day: number, unit: DatePrecision): number {
  const date = fromDays(calendar, Math.floor(day));
  if (unit === "year") return toDays(calendar, { year: date.year });
  if (unit === "month") return toDays(calendar, { year: date.year, month: date.month });
  return toDays(calendar, date);
}
