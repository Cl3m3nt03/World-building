// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { useStrayUndoGuard } from "./useStrayUndoGuard";

const button = document.createElement("button");
const input = document.createElement("input");
const editor = document.createElement("div");
editor.setAttribute("contenteditable", "true");
const line = editor.appendChild(document.createElement("p"));

beforeEach(() => {
  document.body.replaceChildren(button, input, editor);
  renderHook(useStrayUndoGuard);
});
afterEach(cleanup);

/** Presses a key on `target`; true if the browser's own action was stopped. */
function press(target: Element, key: string, init: KeyboardEventInit = { ctrlKey: true }) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

test("outside a text field, Ctrl+Z and Ctrl+Y do nothing", () => {
  expect(press(button, "z")).toBe(true);
  expect(press(button, "y")).toBe(true);
  expect(press(button, "Z", { ctrlKey: true, shiftKey: true })).toBe(true);
  expect(press(document.body, "z")).toBe(true);
});

test("a field and a text editor keep their own history", () => {
  expect(press(input, "z")).toBe(false);
  expect(press(line, "z")).toBe(false);
});

test("other shortcuts are left alone", () => {
  expect(press(button, "b")).toBe(false);
  expect(press(button, "z", {})).toBe(false);
});
