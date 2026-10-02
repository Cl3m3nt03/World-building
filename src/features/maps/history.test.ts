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

test("close changes of one field are one step, other actions are not", () => {
  let history = startHistory("");
  history = record(history, "M", 0, "label");
  history = record(history, "Mo", COALESCE_MS / 2, "label");
  history = record(history, "Mor", COALESCE_MS, "label");
  expect(undo(history).present).toBe("");

  // Different actions in quick succession stay separate steps (the end-to-end
  // run of M4 lost a zone and a text when they were joined).
  let actions = startHistory(0);
  actions = record(actions, 1, 0);
  actions = record(actions, 2, 10);
  actions = record(actions, 3, 20, "label");
  actions = record(actions, 4, 30, "opacity");
  expect(undo(actions).present).toBe(3);
  expect(undo(undo(undo(actions))).present).toBe(1);
});

test("a new change drops the redo, the past is bounded", () => {
  let history = startHistory("Mor");

  history = record(undo(history), "Gondor", 10_000);
  expect(history.future).toEqual([]);

  let long = startHistory(0);
  for (let step = 1; step <= HISTORY_LIMIT + 20; step += 1) {
    long = record(long, step, step * 1000);
  }
  expect(long.past).toHaveLength(HISTORY_LIMIT);
});
