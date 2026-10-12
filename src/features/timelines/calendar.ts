import type { DatePrecision, Era, WorldCalendar } from "@/lib/bindings";

/**
 * The world's calendar (ADR 0011): days are counted from the first day of
 * the year 0; a year is the sum of its months' days (no leap years). Eras
 * only name ranges of years.
 */

/** A date as people say it: a year (of the calendar), maybe a month and a day (from 1). */
export type CalendarDate = { year: number; month?: number; day?: number };

/** Twelve months of thirty days, no era. */
export const DEFAULT_CALENDAR: WorldCalendar = {
  eras: [],
  months: Array.from({ length: 12 }, () => ({ name: "", days: 30 })),
};

export function yearLength(calendar: WorldCalendar): number {
  return Math.max(
    1,
    calendar.months.reduce((sum, month) => sum + month.days, 0),
  );
}

/** Days before the first day of `month` (from 1) in a year. */
function daysBefore(calendar: WorldCalendar, month: number): number {
  let sum = 0;
  for (let index = 0; index < month - 1 && index < calendar.months.length; index++) {
    sum += calendar.months[index]?.days ?? 0;
  }
  return sum;
}

/** The day of a date (its first day when it has no month or no day). */
export function toDays(calendar: WorldCalendar, date: CalendarDate): number {
  const month = clampMonth(calendar, date.month ?? 1);
  const days = calendar.months[month - 1]?.days ?? 1;
  const day = Math.min(Math.max(date.day ?? 1, 1), days);
  return date.year * yearLength(calendar) + daysBefore(calendar, month) + day - 1;
}

/** The last day of a date (its year's or month's last day when less precise). */
export function lastDay(
  calendar: WorldCalendar,
  date: CalendarDate,
  precision: DatePrecision,
): number {
  if (precision === "day") return toDays(calendar, date);
  if (precision === "month") {
    const month = clampMonth(calendar, date.month ?? 1);
    return toDays(calendar, { year: date.year, month, day: calendar.months[month - 1]?.days ?? 1 });
  }
  return toDays(calendar, { year: date.year + 1 }) - 1;
}

function clampMonth(calendar: WorldCalendar, month: number): number {
  return Math.min(Math.max(Math.round(month), 1), Math.max(calendar.months.length, 1));
}

/** The date of a day. */
export function fromDays(calendar: WorldCalendar, days: number): Required<CalendarDate> {
  const length = yearLength(calendar);
  const year = Math.floor(days / length);
  let rest = days - year * length;
  let month = 1;
  for (const each of calendar.months) {
    if (rest < each.days) break;
    rest -= each.days;
    month++;
  }
  return { year, month: Math.min(month, calendar.months.length), day: rest + 1 };
}

/** The eras in order of their start. */
function sortedEras(calendar: WorldCalendar): Era[] {
  return [...calendar.eras].sort((a, b) => a.startYear - b.startYear);
}

/** The era a year belongs to, and the year as it is counted in it. */
export function eraYear(calendar: WorldCalendar, year: number): { era: Era | null; year: number } {
  const eras = sortedEras(calendar);
  let index = -1;
  eras.forEach((era, at) => {
    if (era.startYear <= year) index = at;
  });
  const era = eras[index];
  if (!era) return { era: null, year };
  if (era.backwards) {
    // Counted down to the next era: the year just before it is 1.
    const next = eras[index + 1];
    const end = next ? next.startYear : era.startYear;
    return { era, year: end - year };
  }
  return { era, year: year - era.startYear };
}

/** The calendar year of a year counted in an era (the reverse of `eraYear`). */
export function fromEraYear(calendar: WorldCalendar, era: Era | null, year: number): number {
  if (!era) return year;
  if (era.backwards) {
    const eras = sortedEras(calendar);
    const next = eras[eras.findIndex((each) => each.startYear === era.startYear) + 1];
    return (next ? next.startYear : era.startYear) - year;
  }
  return era.startYear + year;
}

/** Words the format needs from the app's language. */
export type CalendarWords = {
  /** « 3e mois », « Month 3 »: a month without a name. */
  month: (number: number) => string;
  /** « 12 du 3e mois 298 DC », « 12 Lune de feu 298 DC »: the parts in the language's order. */
  day: (day: number, month: string, year: string, named: boolean) => string;
  monthYear: (month: string, year: string) => string;
};

export function monthName(calendar: WorldCalendar, month: number, words: CalendarWords): string {
  const name = calendar.months[month - 1]?.name.trim();
  return name || words.month(month);
}

/** « 298 DC », « Lune de feu 298 DC », « 12 Lune de feu 298 DC ». */
export function formatDate(
  calendar: WorldCalendar,
  days: number,
  precision: DatePrecision,
  words: CalendarWords,
): string {
  const date = fromDays(calendar, days);
  const { era, year } = eraYear(calendar, date.year);
  const yearText = era?.abbreviation.trim() ? `${year} ${era.abbreviation.trim()}` : `${year}`;
  if (precision === "year") return yearText;
  const month = monthName(calendar, date.month, words);
  if (precision === "month") return words.monthYear(month, yearText);
  const named = Boolean(calendar.months[date.month - 1]?.name.trim());
  return words.day(date.day, month, yearText, named);
}
