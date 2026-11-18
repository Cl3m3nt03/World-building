import { beforeEach, expect, test } from "vitest";
import { MAX_TOASTS, useToasts } from "./toasts";

beforeEach(() => {
  useToasts.getState().clear();
});

test("a notification is shown, then dismissed by its id", () => {
  const id = useToasts.getState().show({ message: "A" });
  expect(useToasts.getState().toasts).toEqual([{ id, message: "A", tone: "default" }]);
  useToasts.getState().dismiss(id);
  expect(useToasts.getState().toasts).toEqual([]);
});

test("a new notification pushes the oldest out past the limit", () => {
  for (const message of ["A", "B", "C", "D"]) useToasts.getState().show({ message });
  expect(useToasts.getState().toasts.map((toast) => toast.message)).toEqual(["B", "C", "D"]);
  expect(useToasts.getState().toasts).toHaveLength(MAX_TOASTS);
});

test("ids are never reused, and clear empties the list", () => {
  const first = useToasts.getState().show({ message: "A", tone: "error" });
  useToasts.getState().dismiss(first);
  const second = useToasts.getState().show({ message: "B" });
  expect(second).not.toBe(first);
  useToasts.getState().clear();
  expect(useToasts.getState().toasts).toEqual([]);
});
