import { expect, test } from "vitest";
import type { TimelineItem, WorldCalendar } from "@/lib/bindings";
import { type CalendarWords, DEFAULT_CALENDAR, toDays } from "./calendar";
import {
  centerOn,
  dayAt,
  eraBands,
  extent,
  frame,
  labelled,
  lanes,
  MAX_SCALE,
  ticks,
  tickUnit,
  xOf,
  zoomAt,
} from "./scale";

const words: CalendarWords = {
  month: (n) => (n === 1 ? "1er mois" : `${n}e mois`),
  day: (day, month, year) => `${day} du ${month} ${year}`,
  monthYear: (month, year) => `${month} ${year}`,
};

const westeros: WorldCalendar = {
  eras: [
    { name: "Après la Conquête", abbreviation: "DC", startYear: 0 },
    { name: "Avant la Conquête", abbreviation: "AC", startYear: -12000, backwards: true },
  ],
  months: DEFAULT_CALENDAR.months,
};

function item(start: number, end: number | null = null, id = String(start)): TimelineItem {
  return {
    id,
    trackId: "t",
    cardId: null,
    title: id,
    color: "amber",
    description: "",
    start,
    end,
    precision: "year",
  };
}

test("zooming keeps the day under the pointer where it is", () => {
  const view = { start: 1000, scale: 0.5 };
  const under = dayAt(view, 300);
  for (const factor of [2, 0.1, 37]) {
    const zoomed = zoomAt(view, factor, 300);
    expect(dayAt(zoomed, 300)).toBeCloseTo(under, 6);
  }
  // The scale stops at its bounds, the pointer still holds.
  const most = zoomAt(view, 1e9, 300);
  expect(most.scale).toBe(MAX_SCALE);
  expect(dayAt(most, 300)).toBeCloseTo(under, 6);
});

test("fitting frames the days, centring puts one in the middle", () => {
  const view = frame(0, 999, 1100, 50);
  expect(xOf(view, 0)).toBeCloseTo(50);
  expect(xOf(view, 1000)).toBeCloseTo(1050);
  expect(xOf(centerOn(view, 500, 1100), 500)).toBeCloseTo(550);
});

test("the graduation goes from centuries to days as one zooms in", () => {
  const year = 360;
  expect(tickUnit(DEFAULT_CALENDAR, 1 / year)).toMatchObject({ kind: "year", step: 100 });
  expect(tickUnit(DEFAULT_CALENDAR, 10 / year)).toMatchObject({ kind: "year", step: 10 });
  expect(tickUnit(DEFAULT_CALENDAR, 200 / year)).toMatchObject({ kind: "year", step: 1 });
  expect(tickUnit(DEFAULT_CALENDAR, 3)).toMatchObject({ kind: "month" });
  expect(tickUnit(DEFAULT_CALENDAR, 50)).toMatchObject({ kind: "day", step: 1 });
  // Far out, powers of ten.
  expect(tickUnit(DEFAULT_CALENDAR, 1e-6)).toMatchObject({ kind: "year", step: 1_000_000 });
});

test("ticks are written in the world's calendar", () => {
  const years = ticks(westeros, { start: toDays(westeros, { year: -3 }), scale: 0.5 }, 2000, words);
  expect(years.map((tick) => tick.label)).toContain("1 AC");
  expect(years.map((tick) => tick.label)).toContain("0 DC");
  expect(years.map((tick) => tick.label)).toContain("2 DC");

  const months = ticks(westeros, { start: toDays(westeros, { year: 298 }), scale: 4 }, 500, words);
  expect(months.slice(0, 3).map((tick) => tick.label)).toEqual([
    "1er mois 298 DC",
    "2e mois",
    "3e mois",
  ]);
  expect(months[0]?.major).toBe(true);

  const days = ticks(westeros, { start: toDays(westeros, { year: 298 }), scale: 60 }, 300, words);
  expect(days.slice(0, 6).map((tick) => tick.label)).toEqual([
    "1er mois 298 DC",
    "2",
    "3",
    "4",
    "5",
    "6",
  ]);
});

test("eras are bands up to the next era", () => {
  const bands = eraBands(westeros);
  expect(bands.map((band) => band.era.abbreviation)).toEqual(["AC", "DC"]);
  expect(bands[0]?.to).toBe(-1);
  expect(bands[1]).toMatchObject({ from: 0, to: null });
});

test("the extent covers whole years of year-precise items", () => {
  expect(extent(DEFAULT_CALENDAR, [])).toBeNull();
  expect(extent(DEFAULT_CALENDAR, [item(360), item(0, 720)])).toEqual({ from: 0, to: 1079 });
});

test("items that would overlap go on separate lanes", () => {
  const span = (each: TimelineItem) => ({ left: each.start, right: (each.end ?? each.start) + 10 });
  const result = lanes([item(0, 50, "a"), item(20, null, "b"), item(70, null, "c")], span);
  expect(Object.fromEntries(result)).toEqual({ a: 0, b: 1, c: 0 });
});

test("tick labels never run into each other, the major ones win", () => {
  const graduation = [
    { day: 0, label: "1er mois 298 DC", major: true },
    { day: 1, label: "2", major: false },
    { day: 2, label: "3", major: false },
    { day: 20, label: "21", major: false },
  ];
  // Ten pixels a day: the month's name covers the next days.
  expect([...labelled(graduation, (day) => day * 10)].sort((a, b) => a - b)).toEqual([0, 20]);
});
