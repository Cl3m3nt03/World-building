import type { TimelineItem, WorldCalendar } from "@/lib/bindings";
import { fromDays } from "./calendar";

/**
 * Ages on a timeline (M11+): a period standing for a card and marked as its
 * life runs from birth to death. An age is counted in the world's calendar, in whole years
 * (a birthday not reached yet in the year counts one less).
 */

/** Whole years from `birth` to `day` (negative when not born yet). */
export function ageAt(calendar: WorldCalendar, birth: number, day: number): number {
  const from = fromDays(calendar, birth);
  const to = fromDays(calendar, day);
  const years = to.year - from.year;
  const before = to.month < from.month || (to.month === from.month && to.day < from.day);
  return before ? years - 1 : years;
}

export type Life = { item: TimelineItem; age: number };

/** The lives (periods marked as a card's life) that cover `day`, with the age then; oldest first. */
export function livesAt(
  calendar: WorldCalendar,
  items: readonly TimelineItem[],
  day: number,
  except?: string,
): Life[] {
  return items
    .filter(
      (item) =>
        item.id !== except &&
        (item.life ?? false) &&
        item.cardId !== null &&
        item.end !== null &&
        item.start <= day &&
        day <= item.end,
    )
    .map((item) => ({ item, age: ageAt(calendar, item.start, day) }))
    .sort((a, b) => b.age - a.age);
}
