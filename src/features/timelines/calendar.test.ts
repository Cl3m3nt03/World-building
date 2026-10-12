import { expect, test } from "vitest";
import type { WorldCalendar } from "@/lib/bindings";
import {
  type CalendarWords,
  DEFAULT_CALENDAR,
  eraYear,
  formatDate,
  fromDays,
  fromEraYear,
  lastDay,
  toDays,
  yearLength,
} from "./calendar";

const words: CalendarWords = {
  month: (n) => (n === 1 ? "1er mois" : `${n}e mois`),
  day: (day, month, year, named) =>
    named ? `${day} ${month} ${year}` : `${day} du ${month} ${year}`,
  monthYear: (month, year) => `${month} ${year}`,
};

const westeros: WorldCalendar = {
  eras: [
    { name: "Après la Conquête", abbreviation: "DC", startYear: 0 },
    { name: "Avant la Conquête", abbreviation: "AC", startYear: -12000, backwards: true },
  ],
  months: Array.from({ length: 12 }, () => ({ name: "", days: 30 })),
};

test("days count from the year 0, and back", () => {
  expect(yearLength(DEFAULT_CALENDAR)).toBe(360);
  expect(toDays(DEFAULT_CALENDAR, { year: 0 })).toBe(0);
  expect(toDays(DEFAULT_CALENDAR, { year: 298, month: 3, day: 12 })).toBe(298 * 360 + 60 + 11);
  expect(fromDays(DEFAULT_CALENDAR, 298 * 360 + 71)).toEqual({ year: 298, month: 3, day: 12 });
  // Before the year 0.
  expect(fromDays(DEFAULT_CALENDAR, -1)).toEqual({ year: -1, month: 12, day: 30 });
  expect(toDays(DEFAULT_CALENDAR, { year: -1, month: 12, day: 30 })).toBe(-1);
});

test("the last day of a year or a month", () => {
  expect(lastDay(DEFAULT_CALENDAR, { year: 1 }, "year")).toBe(719);
  expect(lastDay(DEFAULT_CALENDAR, { year: 1, month: 2 }, "month")).toBe(360 + 59);
});

test("eras count up, or down to the next era", () => {
  expect(eraYear(westeros, 298)).toMatchObject({ year: 298, era: { abbreviation: "DC" } });
  expect(eraYear(westeros, -2)).toMatchObject({ year: 2, era: { abbreviation: "AC" } });
  expect(fromEraYear(westeros, westeros.eras[1] ?? null, 2)).toBe(-2);
  expect(fromEraYear(westeros, westeros.eras[0] ?? null, 298)).toBe(298);
  expect(eraYear(DEFAULT_CALENDAR, 5)).toEqual({ era: null, year: 5 });
});

test("a date is written in the calendar's words", () => {
  const day = toDays(westeros, { year: 298, month: 3, day: 12 });
  expect(formatDate(westeros, day, "day", words)).toBe("12 du 3e mois 298 DC");
  expect(formatDate(westeros, day, "month", words)).toBe("3e mois 298 DC");
  expect(formatDate(westeros, day, "year", words)).toBe("298 DC");
  const named = {
    ...westeros,
    months: [{ name: "Lune de feu", days: 30 }, ...westeros.months.slice(1)],
  };
  expect(formatDate(named, toDays(named, { year: -2 }), "month", words)).toBe("Lune de feu 2 AC");
});
