import { expect, test } from "vitest";
import { COALESCE_MS, HISTORY_LIMIT, record, redo, startHistory, undo } from "./history";

test("ten actions undone then redone give the same state back", () => {
  let history = startHistory(0);
  for (let step = 1; step <= 10; step += 1) {
    history = record(history, step, step * 1000);
  }
  expect(history.present).toBe(10);
  for (let step = 0; step < 10; step += 1) history = undo(history);
  expect(history.present).toBe(0);
  expect(undo(history)).toBe(history);
  for (let step = 0; step < 10; step += 1) history = redo(history);
  expect(history.present).toBe(10);
  expect(redo(history)).toBe(history);
});

test("close changes are one step, a new change drops the redo, the past is bounded", () => {
  let history = startHistory("");
  history = record(history, "M", 0);
  history = record(history, "Mo", COALESCE_MS / 2);
  history = record(history, "Mor", COALESCE_MS);
  expect(undo(history).present).toBe("");

  history = record(undo(history), "Gondor", 10_000);
  expect(history.future).toEqual([]);

  let long = startHistory(0);
  for (let step = 1; step <= HISTORY_LIMIT + 20; step += 1) {
    long = record(long, step, step * 1000);
  }
  expect(long.past).toHaveLength(HISTORY_LIMIT);
});
