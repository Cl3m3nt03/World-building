// @vitest-environment jsdom
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { SIDEBAR_WIDTH, useUiStore } from "@/app/stores/ui";
import { i18n } from "@/i18n";
import type { AppSettings, Preferences } from "@/lib/bindings";
import { loadPreferences, usePreferencesSync } from "./preferences";

const saved: AppSettings = {
  preferences: { language: "en", theme: "dark", transparencyEffects: false },
  recentWorlds: [],
  defaultWorldsDir: null,
};

beforeEach(async () => {
  useUiStore.setState({ theme: "system", transparency: "on", sidebarWidth: SIDEBAR_WIDTH.default });
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
    { language: "fr", theme: "light", transparencyEffects: true },
    { language: "fr", theme: "light", transparencyEffects: false },
    { language: "en", theme: "light", transparencyEffects: false },
  ]);
  await i18n.changeLanguage("fr");
});
