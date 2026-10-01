// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Asset } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { ImagePickerDialog } from "./ImagePickerDialog";

function image(letter: string, name: string): Asset {
  return {
    id: `${letter.repeat(64)}.png`,
    name,
    kind: "image",
    mime: "image/png",
    size: 1024,
    width: 64,
    height: 64,
    createdAt: "2026-09-26T10:00:00Z",
  };
}

const CASTLE = image("a", "Château.png");
const FOREST = image("b", "Forêt.png");
const IMPORTED = image("c", "Import.png");

type Call = { command: string; payload: unknown };
let calls: Call[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  calls = [];
  mockIPC((command, payload) => {
    calls.push({ command, payload });
    if (command === "list_assets") {
      const { filter } = payload as { filter: { search: string | null } };
      return [CASTLE, FOREST].filter(
        (asset) => !filter.search || asset.name.toLowerCase().includes(filter.search.toLowerCase()),
      );
    }
    if (command === "plugin:dialog|open") return "C:\\images\\import.png";
    if (command === "import_asset") return { asset: IMPORTED, created: true };
    return null;
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

function renderPicker(selectedId: string | null = null) {
  const onPick = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ImagePickerDialog open onOpenChange={onOpenChange} onPick={onPick} selectedId={selectedId} />
    </QueryClientProvider>,
  );
  return { onPick, onOpenChange };
}

test("lists only images of the media library", async () => {
  renderPicker();

  await screen.findByRole("option", { name: "Château.png" });
  expect(screen.getAllByRole("option")).toHaveLength(2);
  expect(calls).toContainEqual({
    command: "list_assets",
    payload: { filter: { kind: "image", search: null } },
  });
});

test("returns the clicked image when confirmed", async () => {
  const { onPick, onOpenChange } = renderPicker();

  fireEvent.click(await screen.findByRole("option", { name: "Forêt.png" }));
  fireEvent.click(screen.getByRole("button", { name: "Choisir" }));

  expect(onPick).toHaveBeenCalledWith(FOREST.id);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("browses with the arrow keys and confirms with Enter", async () => {
  const { onPick } = renderPicker(CASTLE.id);
  const castle = await screen.findByRole("option", { name: "Château.png" });
  expect(castle.getAttribute("aria-selected")).toBe("true");

  fireEvent.keyDown(castle, { key: "ArrowRight" });
  const forest = screen.getByRole("option", { name: "Forêt.png" });
  expect(forest.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(forest);
  fireEvent.keyDown(forest, { key: "Enter" });

  expect(onPick).toHaveBeenCalledWith(FOREST.id);
});

test("searches by name", async () => {
  renderPicker();
  await screen.findByRole("option", { name: "Château.png" });

  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "forê" } });

  await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
  expect(screen.getByRole("option", { name: "Forêt.png" })).toBeTruthy();
});

test("returns an imported image right away", async () => {
  const { onPick } = renderPicker();
  await screen.findByRole("option", { name: "Château.png" });

  fireEvent.click(screen.getByRole("button", { name: "Importer une image" }));

  await waitFor(() => expect(onPick).toHaveBeenCalledWith(IMPORTED.id));
  expect(calls).toContainEqual({
    command: "import_asset",
    payload: { path: "C:\\images\\import.png" },
  });
});

test("several images: Space ticks them, Enter returns them in the order ticked", async () => {
  const onPickMany = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ImagePickerDialog
        open
        multiple
        max={5}
        onOpenChange={onOpenChange}
        onPickMany={onPickMany}
      />
    </QueryClientProvider>,
  );

  const castle = await screen.findByRole("option", { name: "Château.png" });
  castle.focus();
  fireEvent.keyDown(castle, { key: "ArrowRight" });
  const forest = screen.getByRole("option", { name: "Forêt.png" });
  fireEvent.keyDown(forest, { key: " " });
  fireEvent.keyDown(forest, { key: "ArrowLeft" });
  fireEvent.keyDown(castle, { key: " " });
  expect(castle.getAttribute("aria-selected")).toBe("true");
  expect(forest.getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(castle, { key: "Enter" });

  expect(onPickMany).toHaveBeenCalledWith([FOREST.id, CASTLE.id]);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
