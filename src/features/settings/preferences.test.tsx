// @vitest-environment jsdom
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useUiStore } from "@/app/stores/ui";
import { i18n } from "@/i18n";
import type { AppSettings, Preferences } from "@/lib/bindings";
import { loadPreferences, usePreferencesSync } from "./preferences";

const saved: AppSettings = {
  preferences: {
    language: "en",
    theme: "dark",
    transparencyEffects: false,
    radioVolume: 70,
    radioMode: "loop",
    worldRail: false,
    cornerRadius: 100,
  },
  recentWorlds: [],
  defaultWorldsDir: null,
};

beforeEach(async () => {
  useUiStore.setState({ theme: "system", transparency: "on" });
  await i18n.changeLanguage("fr");
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

test("loadPreferences applies the saved preferences to the UI store", async () => {
  mockIPC((command) => (command === "get_settings" ? saved : undefined));

  const language = await loadPreferences();

  expect(language).toBe("en");
  expect(useUiStore.getState().theme).toBe("dark");
  expect(useUiStore.getState().transparency).toBe("off");
  expect(useUiStore.getState().cornerRadius).toBe(100);
});

test("loadPreferences applies the saved corner radius (#616)", async () => {
  mockIPC((command) =>
    command === "get_settings"
      ? { ...saved, preferences: { ...saved.preferences, cornerRadius: 30 } }
      : undefined,
  );

  await loadPreferences();

  expect(useUiStore.getState().cornerRadius).toBe(30);
  useUiStore.setState({ cornerRadius: 100 });
});

test("loadPreferences falls back to the defaults when Rust is unavailable", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});

  const language = await loadPreferences();

  expect(language).toBe("fr");
  expect(useUiStore.getState().theme).toBe("system");
});

test("usePreferencesSync saves theme, transparency and language changes", async () => {
  const updates: Preferences[] = [];
  mockIPC((command, payload) => {
    if (command === "update_preferences") {
      const { preferences } = payload as { preferences: Preferences };
      updates.push(preferences);
      return { ...saved, preferences };
    }
    return undefined;
  });
  renderHook(() => usePreferencesSync());

  await act(async () => {
    useUiStore.getState().setTheme("light");
    useUiStore.getState().setTransparency("off");
    await i18n.changeLanguage("en");
  });

  expect(updates).toEqual([
    {
      language: "fr",
      theme: "light",
      transparencyEffects: true,
      radioVolume: 70,
      radioMode: "loop",
      worldRail: false,
      cornerRadius: 100,
    },
    {
      language: "fr",
      theme: "light",
      transparencyEffects: false,
      radioVolume: 70,
      radioMode: "loop",
      worldRail: false,
      cornerRadius: 100,
    },
    {
      language: "en",
      theme: "light",
      transparencyEffects: false,
      radioVolume: 70,
      radioMode: "loop",
      worldRail: false,
      cornerRadius: 100,
    },
  ]);
  await i18n.changeLanguage("fr");
});

test("usePreferencesSync saves the corner radius once the slider settles (#616)", async () => {
  vi.useFakeTimers();
  const updates: Preferences[] = [];
  mockIPC((command, payload) => {
    if (command === "update_preferences") {
      const { preferences } = payload as { preferences: Preferences };
      updates.push(preferences);
      return { ...saved, preferences };
    }
    return undefined;
  });
  renderHook(() => usePreferencesSync());

  act(() => {
    for (const percent of [90, 70, 50, 30]) useUiStore.getState().setCornerRadius(percent);
  });
  expect(updates).toEqual([]);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });

  expect(updates.map((preferences) => preferences.cornerRadius)).toEqual([30]);
  vi.useRealTimers();
  useUiStore.setState({ cornerRadius: 100 });
});
