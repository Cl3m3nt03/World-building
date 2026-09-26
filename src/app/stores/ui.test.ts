import { beforeEach, expect, test } from "vitest";
import { SIDEBAR_WIDTH, useUiStore } from "./ui";

beforeEach(() => {
  useUiStore.setState({ theme: "system", transparency: "on", sidebarWidth: SIDEBAR_WIDTH.default });
});

test("defaults: system theme, transparency on, default sidebar width", () => {
  const state = useUiStore.getState();
  expect(state.theme).toBe("system");
  expect(state.transparency).toBe("on");
  expect(state.sidebarWidth).toBe(SIDEBAR_WIDTH.default);
});

test("setters update the store", () => {
  useUiStore.getState().setTheme("dark");
  useUiStore.getState().setTransparency("off");
  useUiStore.getState().setSidebarWidth(360);
  const state = useUiStore.getState();
  expect(state.theme).toBe("dark");
  expect(state.transparency).toBe("off");
  expect(state.sidebarWidth).toBe(360);
});

test("sidebar width is clamped to its bounds", () => {
  useUiStore.getState().setSidebarWidth(10);
  expect(useUiStore.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.min);
  useUiStore.getState().setSidebarWidth(9999);
  expect(useUiStore.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.max);
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
