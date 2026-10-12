import { expect, test } from "vitest";
import type { TimelineItem, WorldCalendar } from "@/lib/bindings";
import { DEFAULT_CALENDAR, fromDays, toDays } from "./calendar";
import { moveItem, shiftDay, snapDay, stepOf, stretchItem, unitsIn } from "./edit";

const uneven: WorldCalendar = {
  eras: [],
  months: [
    { name: "Long", days: 40 },
    { name: "Court", days: 10 },
  ],
};

function period(start: number, end: number | null): TimelineItem {
  return {
    id: "i",
    trackId: "t",
    cardId: null,
    title: "",
    color: "amber",
    description: "",
    start,
    end,
    precision: "day",
  };
}

test("a drag goes by the visible unit, never finer than the date", () => {
  expect(stepOf("day", "year")).toBe("year");
  expect(stepOf("year", "day")).toBe("year");
  expect(stepOf("month", "day")).toBe("month");
});

test("moving by years or months keeps the month and the day", () => {
  const day = toDays(DEFAULT_CALENDAR, { year: 298, month: 3, day: 12 });
  expect(fromDays(DEFAULT_CALENDAR, shiftDay(DEFAULT_CALENDAR, day, "year", 1))).toEqual({
    year: 299,
    month: 3,
    day: 12,
  });
  expect(fromDays(DEFAULT_CALENDAR, shiftDay(DEFAULT_CALENDAR, day, "month", -3))).toEqual({
    year: 297,
    month: 12,
    day: 12,
  });
  // A day past a short month's end is kept to its last day.
  const long = toDays(uneven, { year: 5, month: 1, day: 35 });
  expect(fromDays(uneven, shiftDay(uneven, long, "month", 1))).toEqual({
    year: 5,
    month: 2,
    day: 10,
  });
});

test("an item moves whole; a period stretches without ending before it starts", () => {
  const item = period(100, 110);
  expect(moveItem(DEFAULT_CALENDAR, item, "day", 5)).toMatchObject({ start: 105, end: 115 });
  expect(moveItem(DEFAULT_CALENDAR, period(100, null), "day", -1)).toMatchObject({
    start: 99,
    end: null,
  });
  expect(stretchItem(DEFAULT_CALENDAR, item, "end", "day", 3)).toMatchObject({ end: 113 });
  expect(stretchItem(DEFAULT_CALENDAR, item, "end", "day", -20)).toBe(item);
  expect(stretchItem(DEFAULT_CALENDAR, item, "start", "day", 10)).toMatchObject({ start: 110 });
  expect(stretchItem(DEFAULT_CALENDAR, item, "start", "day", 11)).toBe(item);
});

test("pixels make whole units, and a new item lands at its unit's start", () => {
  expect(unitsIn(DEFAULT_CALENDAR, 100, 1 / 36, "year")).toBe(10);
  expect(unitsIn(DEFAULT_CALENDAR, 44, 1, "month")).toBe(1);
  expect(unitsIn(DEFAULT_CALENDAR, 14, 1, "month")).toBe(0);
  const day = toDays(DEFAULT_CALENDAR, { year: 3, month: 4, day: 20 });
  expect(snapDay(DEFAULT_CALENDAR, day + 0.6, "year")).toBe(toDays(DEFAULT_CALENDAR, { year: 3 }));
  expect(snapDay(DEFAULT_CALENDAR, day, "month")).toBe(
    toDays(DEFAULT_CALENDAR, { year: 3, month: 4 }),
  );
});
