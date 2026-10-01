// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { StorageUsage } from "@/lib/bindings";
import { errorKey, IpcError } from "@/lib/ipc";
import { createQueryClient } from "@/lib/query";
import { StorageSection } from "./components/StorageSection";
import { isDiskLow, LOW_DISK, limitBytes, limitParts, MIN_LIMIT, storageLevel } from "./storage";

const MB = 1024 * 1024;
const GB = 1024 * MB;

function usage(extra: Partial<StorageUsage> = {}): StorageUsage {
  return {
    database: 2 * MB,
    media: 300 * MB,
    mediaCount: 12,
    backups: MB,
    total: 303 * MB,
    available: 50 * GB,
    limit: null,
    ...extra,
  };
}

let storage: StorageUsage;
let calls: { command: string; payload: unknown }[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  storage = usage();
  calls = [];
  mockIPC((command, payload) => {
    calls.push({ command, payload });
    if (command === "world_storage") return storage;
    if (command === "set_world_storage_limit") {
      storage = { ...storage, limit: (payload as { limit: number | null }).limit };
      return { id: "w", storageLimit: storage.limit };
    }
    return null;
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

function renderSection() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <StorageSection />
    </QueryClientProvider>,
  );
}

test("levels, low disk and limit conversions", () => {
  expect(storageLevel(usage())).toBe("ok");
  expect(storageLevel(usage({ limit: 400 * MB }))).toBe("ok");
  expect(storageLevel(usage({ limit: 320 * MB }))).toBe("warning");
  expect(storageLevel(usage({ limit: 303 * MB }))).toBe("full");
  expect(isDiskLow(usage({ available: LOW_DISK - 1 }))).toBe(true);
  expect(isDiskLow(usage({ available: null }))).toBe(false);

  expect(limitBytes(2, "GB")).toBe(2 * GB);
  expect(limitBytes(1.5, "GB")).toBe(1.5 * GB);
  expect(limitBytes(1, "MB")).toBe(MIN_LIMIT);
  expect(limitBytes(0, "GB")).toBeNull();
  expect(limitBytes(Number.NaN, "MB")).toBeNull();
  expect(limitParts(2 * GB)).toEqual({ value: 2, unit: "GB" });
  expect(limitParts(1.5 * GB)).toEqual({ value: 1.5, unit: "GB" });
  expect(limitParts(750 * MB)).toEqual({ value: 750, unit: "MB" });
});

test("a full world's import error reads as the storage limit", () => {
  expect(
    errorKey(new IpcError({ code: "storage_limit_reached", message: "2147483648 bytes" })),
  ).toBe("errors.storage_limit_reached");
});

test("shows the space used by the world and left on the disk", async () => {
  renderSection();

  expect(await screen.findByText("Médias (12 fichiers)")).toBeTruthy();
  expect(screen.getByText("Total du monde")).toBeTruthy();
  expect(screen.getByText("Place libre sur le disque")).toBeTruthy();
  expect(
    (
      screen.getByRole("switch", { name: "Limiter la place de ce monde" }) as HTMLElement
    ).getAttribute("aria-checked"),
  ).toBe("false");
});

test("a limit is set, changed, and the world warns near it", async () => {
  renderSection();

  fireEvent.click(await screen.findByRole("switch", { name: "Limiter la place de ce monde" }));
  await waitFor(() =>
    expect(calls).toContainEqual({ command: "set_world_storage_limit", payload: { limit: GB } }),
  );

  const value = await screen.findByLabelText("Limite");
  fireEvent.change(value, { target: { value: "320" } });
  fireEvent.click(screen.getByRole("combobox", { name: "Unité" }));
  fireEvent.click(await screen.findByRole("option", { name: "Mo" }));
  fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));

  await waitFor(() =>
    expect(calls).toContainEqual({
      command: "set_world_storage_limit",
      payload: { limit: 320 * MB },
    }),
  );
  expect(await screen.findByText("Ce monde approche de sa limite de 320 Mo.")).toBeTruthy();
  expect(screen.getByRole("progressbar", { name: "95 % de la limite" })).toBeTruthy();
});

test("a full world and a nearly full disk say so", async () => {
  storage = usage({ limit: 300 * MB, available: 100 * MB });
  renderSection();

  expect((await screen.findByRole("alert")).textContent).toMatch(
    /^Ce monde a atteint sa limite de 300\sMo : les nouveaux imports sont refusés\./,
  );
  expect(screen.getByText(/Le disque est presque plein : il reste 100\sMo\./)).toBeTruthy();
});
