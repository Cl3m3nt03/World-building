import { expect, test } from "vitest";
import { clock, left, pause, resume, start, tick } from "./session";

test("a session counts down, pauses, resumes and ends with the words written", () => {
  let session = start(1, 100, 0);
  expect(left(session, 20_000)).toBe(40_000);
  session = pause(session, 20_000);
  expect(left(session, 90_000)).toBe(40_000);
  session = tick(session, 120, 90_000);
  expect(session.state).toBe("paused");
  session = resume(session, 90_000);
  expect(left(session, 100_000)).toBe(30_000);
  session = tick(session, 137, 130_000);
  expect(session).toEqual({ state: "over", written: 37 });
});

test("words taken out do not count below zero; durations are bounded", () => {
  expect(tick(start(1, 50, 0), 10, 60_000)).toEqual({ state: "over", written: 0 });
  expect(left(start(0, 0, 0), 0)).toBe(60_000);
  expect(left(start(9999, 0, 0), 0)).toBe(240 * 60_000);
});

test("the clock", () => {
  expect(clock(25 * 60_000)).toBe("25:00");
  expect(clock(61_500)).toBe("1:02");
  expect(clock(3_725_000)).toBe("1:02:05");
});
