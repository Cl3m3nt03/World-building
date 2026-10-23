import { expect, test } from "vitest";
import type { TimelineItem } from "@/lib/bindings";
import { ageAt, livesAt } from "./ages";
import { DEFAULT_CALENDAR, toDays } from "./calendar";

const day = (year: number, month = 1, date = 1) =>
  toDays(DEFAULT_CALENDAR, { year, month, day: date });

function life(id: string, start: number, end: number | null, cardId: string | null = id) {
  return {
    id,
    trackId: "t",
    cardId,
    title: "",
    color: "slate",
    description: "",
    start,
    end,
    precision: "day",
    life: true,
  } satisfies TimelineItem;
}

test("an age counts whole years, one less before the birthday", () => {
  expect(ageAt(DEFAULT_CALENDAR, day(263, 6, 10), day(298, 6, 10))).toBe(35);
  expect(ageAt(DEFAULT_CALENDAR, day(263, 6, 10), day(298, 6, 9))).toBe(34);
  expect(ageAt(DEFAULT_CALENDAR, day(263, 6, 10), day(263, 12, 1))).toBe(0);
});

test("the lives covering a day: periods standing for a card, oldest first", () => {
  const items = [
    life("ned", day(263), day(299)),
    life("robert", day(262), day(298, 6)),
    life("jon", day(283), null), // an event: no life
    life("war", day(282), day(283), null), // no card: no life
    life("arya", day(289), day(320)),
    // A reign, not a life.
    { ...life("reign", day(283), day(298)), life: false },
  ];
  expect(livesAt(DEFAULT_CALENDAR, items, day(298, 3)).map((l) => [l.item.id, l.age])).toEqual([
    ["robert", 36],
    ["ned", 35],
    ["arya", 9],
  ]);
  expect(livesAt(DEFAULT_CALENDAR, items, day(298, 3), "ned").map((l) => l.item.id)).toEqual([
    "robert",
    "arya",
  ]);
});
