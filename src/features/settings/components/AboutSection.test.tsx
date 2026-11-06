// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { AppInfo } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { AboutSection } from "./AboutSection";

afterEach(() => {
  cleanup();
  clearMocks();
});

function renderDialog() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AboutSection />
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

test("shows the app's emblem, described for a screen reader", () => {
  mockIPC(() => undefined);

  renderDialog();

  const emblem = screen.getByRole("img", {
    name: "Emblème : une rose des vents au-dessus d'un livre ouvert",
  });
  expect(emblem.getAttribute("src")).toMatch(/emblem/);
});

test("opens the third-party licences, searches them and comes back", async () => {
  const rule = "=".repeat(80);
  const thin = "-".repeat(80);
  const notices = [
    "Atlasaga - third-party notices",
    rule,
    "§ MIT",
    "Rust crates: serde 1.0.0",
    thin,
    "MIT License text",
    rule,
    "§ OFL-1.1",
    "Bundled assets: Excalifont (Excalidraw canvas font)",
    thin,
    "SIL Open Font License text",
  ].join("\n");
  mockIPC((command) => (command === "third_party_notices" ? notices : undefined));

  renderDialog();
  fireEvent.click(screen.getByRole("button", { name: "Licences tierces" }));

  expect(await screen.findByText("2 licences")).toBeTruthy();
  expect(screen.getByText("Ressources incluses")).toBeTruthy();
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Rechercher un composant ou une licence" }),
    { target: { value: "serde" } },
  );
  expect(await screen.findByText("1 licence")).toBeTruthy();
  expect(screen.queryByText("OFL-1.1")).toBeNull();

  const toggle = screen.getByRole("button", { name: "Afficher le texte" });
  fireEvent.click(toggle);
  expect(screen.getByText("MIT License text")).toBeTruthy();
  expect(toggle.getAttribute("aria-expanded")).toBe("true");

  fireEvent.click(screen.getByRole("button", { name: "Retour" }));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Licences tierces" }));
});
