// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { SIDEBAR_WIDTH, useUiStore } from "@/app/stores/ui";
import { i18n } from "@/i18n";
import type { AppSettings } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { SettingsDialog } from "./SettingsDialog";

let settings: AppSettings;
const calls: { command: string; payload: unknown }[] = [];

beforeEach(async () => {
  calls.length = 0;
  settings = {
    preferences: { language: "fr", theme: "system", transparencyEffects: true },
    recentWorlds: [],
    defaultWorldsDir: "D:/Mondes",
  };
  useUiStore.setState({ theme: "system", transparency: "on", sidebarWidth: SIDEBAR_WIDTH.default });
  await i18n.changeLanguage("fr");
  mockIPC((command, payload) => {
    calls.push({ command, payload });
    if (command === "get_settings") return settings;
    if (command === "set_default_worlds_dir") {
      settings = { ...settings, defaultWorldsDir: (payload as { path: string | null }).path };
      return settings;
    }
    if (command === "app_info") {
      return { version: "0.1.0", configDir: "C:/c", dataDir: "C:/d", logDir: "C:/l" };
    }
    return null;
  });
});

afterEach(async () => {
  cleanup();
  clearMocks();
  await i18n.changeLanguage("fr");
});

function renderDialog() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SettingsDialog open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

test("changes the theme and the transparency effects", async () => {
  renderDialog();

  fireEvent.click(screen.getByRole("radio", { name: "Sombre" }));
  fireEvent.click(screen.getByRole("switch", { name: "Effets de transparence" }));

  expect(useUiStore.getState().theme).toBe("dark");
  expect(useUiStore.getState().transparency).toBe("off");
});

test("changes the language", async () => {
  renderDialog();

  await act(async () => {
    fireEvent.click(screen.getByRole("radio", { name: "English" }));
  });

  expect(i18n.language).toBe("en");
});

test("shows the chosen worlds folder and resets it to the default", async () => {
  renderDialog();

  const folder = screen.getByRole("textbox", { name: "Dossier des nouveaux mondes" });
  await waitFor(() => expect((folder as HTMLInputElement).value).toBe("D:/Mondes"));

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Par défaut" }));
  });

  await waitFor(() =>
    expect((folder as HTMLInputElement).value).toBe("Documents\\BuilderZ (par défaut)"),
  );
  expect(calls.find((call) => call.command === "set_default_worlds_dir")?.payload).toEqual({
    path: null,
  });
});

test("includes the About section", async () => {
  renderDialog();
  expect(await screen.findByText("0.1.0")).toBeTruthy();
});
