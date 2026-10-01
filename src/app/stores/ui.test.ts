import { beforeEach, expect, test } from "vitest";
import { useUiStore } from "./ui";

beforeEach(() => {
  useUiStore.setState({ theme: "system", transparency: "on" });
});

test("defaults: system theme, transparency on", () => {
  const state = useUiStore.getState();
  expect(state.theme).toBe("system");
  expect(state.transparency).toBe("on");
});

test("setters update the store", () => {
  useUiStore.getState().setTheme("dark");
  useUiStore.getState().setTransparency("off");
  const state = useUiStore.getState();
  expect(state.theme).toBe("dark");
  expect(state.transparency).toBe("off");
});

test("radio volume is rounded, clamped, and ignores non-numbers", () => {
  useUiStore.setState({ radioVolume: 70 });
  useUiStore.getState().setRadioVolume(42.6);
  expect(useUiStore.getState().radioVolume).toBe(43);
  useUiStore.getState().setRadioVolume(250);
  expect(useUiStore.getState().radioVolume).toBe(100);
  useUiStore.getState().setRadioVolume(Number.NaN);
  expect(useUiStore.getState().radioVolume).toBe(100);
});
