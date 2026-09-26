// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { AppInfo } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { AboutDialog } from "./AboutDialog";

afterEach(() => {
  cleanup();
  clearMocks();
});

function renderDialog() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AboutDialog open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

test("shows the app info returned by the Rust command", async () => {
  const info: AppInfo = {
    version: "0.1.0",
    configDir: "C:\\config",
    dataDir: "C:\\data",
    logDir: "C:\\logs",
  };
  mockIPC((command) => (command === "app_info" ? info : undefined));

  renderDialog();

  expect(await screen.findByText("0.1.0")).toBeTruthy();
  expect(screen.getByText("C:\\logs")).toBeTruthy();
});

test("shows a translated message when the Rust command fails", async () => {
  mockIPC(() => {
    throw { code: "path_unavailable", message: "log: no local app data" };
  });

  renderDialog();

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Un dossier système est introuvable.");
  expect(alert.textContent).toContain("log: no local app data");
});
