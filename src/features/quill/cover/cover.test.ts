import { expect, test } from "vitest";
import { lightText, wrapLines } from "./coverArt";
import { dragged, eased, keyed, REST, STEP } from "./turn";

test("a title is broken into lines that fit", () => {
  const measure = (line: string) => line.length * 10;
  expect(wrapLines("La Chute du Roi", measure, 90)).toEqual(["La Chute", "du Roi"]);
  expect(wrapLines("  Anticonstitutionnellement ", measure, 50)).toEqual([
    "Anticonstitutionnellement",
  ]);
  expect(wrapLines("", measure, 50)).toEqual([]);
});

test("text is light on a dark book", () => {
  expect(lightText("#2f4b6e")).toBe(true);
  expect(lightText("#e8e0cc")).toBe(false);
});

test("the book turns with the pointer and the keys, and comes back to rest", () => {
  const turned = dragged(REST, 100, 1000);
  expect(turned.yaw).toBeCloseTo(REST.yaw + 1);
  expect(turned.tilt).toBe(0.5);
  expect(keyed(REST, "ArrowRight")?.yaw).toBeCloseTo(REST.yaw + STEP);
  expect(keyed(turned, "Home")).toEqual(REST);
  expect(keyed(REST, "a")).toBeNull();
  let current = turned;
  for (let i = 0; i < 200; i++) current = eased(current, REST) ?? current;
  expect(eased(current, REST)).toBeNull();
});
