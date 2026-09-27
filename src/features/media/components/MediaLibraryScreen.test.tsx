// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Asset } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { MediaLibraryScreen } from "./MediaLibraryScreen";

const IMAGE: Asset = {
  id: `${"a".repeat(64)}.png`,
  name: "Carte du monde.png",
  kind: "image",
  mime: "image/png",
  size: 2048,
  width: 800,
  height: 600,
  createdAt: "2026-09-26T10:00:00Z",
};
const SOUND: Asset = {
  ...IMAGE,
  id: `${"b".repeat(64)}.mp3`,
  name: "Taverne.mp3",
  kind: "audio",
  mime: "audio/mpeg",
  width: null,
  height: null,
};

type Call = { command: string; payload: unknown };
let calls: Call[];
let assets: Asset[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  calls = [];
  assets = [IMAGE, SOUND];
  mockIPC((command, payload) => {
    calls.push({ command, payload });
    if (command === "list_assets") {
      const { filter } = payload as { filter: { kind: string | null } };
      return assets.filter((asset) => !filter.kind || asset.kind === filter.kind);
    }
    if (command === "asset_usages") {
      const { id } = payload as { id: string };
      return id === IMAGE.id
        ? [
            { kind: "worldMainImage", worldName: "Aldoria" },
            { kind: "cardImage", cardId: "c1", cardTitle: "Aelin", inTrash: false },
            { kind: "cardBlock", cardId: "c2", cardTitle: "Rowan", inTrash: true },
          ]
        : [];
    }
    if (command === "rename_asset") {
      const { id, name } = payload as { id: string; name: string };
      assets = assets.map((asset) => (asset.id === id ? { ...asset, name } : asset));
      return assets.find((asset) => asset.id === id);
    }
    if (command === "delete_asset") {
      const { id } = payload as { id: string };
      assets = assets.filter((asset) => asset.id !== id);
      return null;
    }
    if (command === "import_asset_data") {
      return { asset: IMAGE, created: true };
    }
    return null;
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

function renderScreen() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MediaLibraryScreen />
    </QueryClientProvider>,
  );
}

test("lists the assets with their preview, kind and size", async () => {
  renderScreen();

  const image = await screen.findByRole("img", { name: "Carte du monde.png" });
  expect(image.getAttribute("src")).toBe(`http://bzasset.localhost/${IMAGE.id}`);
  expect(screen.getByText("Taverne.mp3")).toBeTruthy();
  expect(screen.getByText("Son")).toBeTruthy();
  expect(screen.getAllByText(/2\s?ko/i).length).toBeGreaterThan(0);
});

test("filters by kind through the Rust command", async () => {
  renderScreen();
  await screen.findByText("Taverne.mp3");

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Sons" }));
  });

  await waitFor(() => expect(screen.queryByText("Carte du monde.png")).toBeNull());
  expect(screen.getByRole("button", { name: "Sons" }).getAttribute("aria-pressed")).toBe("true");
  expect(calls.at(-1)).toMatchObject({
    command: "list_assets",
    payload: { filter: { kind: "audio", search: null } },
  });
});

test("imports an image pasted with Ctrl+V", async () => {
  renderScreen();
  await screen.findByText("Taverne.mp3");

  const file = new File([new Uint8Array([1, 2, 3])], "clipboard.png", { type: "image/png" });
  const paste = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(paste, "clipboardData", {
    value: { items: [{ type: "image/png", getAsFile: () => file }] },
  });
  await act(async () => {
    window.dispatchEvent(paste);
  });

  await waitFor(() =>
    expect(calls.some((call) => call.command === "import_asset_data")).toBe(true),
  );
  const payload = calls.find((call) => call.command === "import_asset_data")?.payload as {
    name: string;
    data: number[];
  };
  expect(payload.name).toMatch(/^Image collée .+\.png$/);
  expect(payload.data).toEqual([1, 2, 3]);
});

test("explains how to add files when the library is empty", async () => {
  assets = [];
  renderScreen();
  expect(await screen.findByText(/La médiathèque est vide/)).toBeTruthy();
});

test("renames an asset with F2 on its actions button", async () => {
  renderScreen();
  const actions = await screen.findByRole("button", { name: "Actions pour Taverne.mp3" });

  fireEvent.keyDown(actions, { key: "F2" });
  const input = await screen.findByDisplayValue("Taverne.mp3");
  fireEvent.change(input, { target: { value: "Auberge.mp3" } });
  fireEvent.submit(input);

  await screen.findByText("Auberge.mp3");
  expect(calls).toContainEqual({
    command: "rename_asset",
    payload: { id: SOUND.id, name: "Auberge.mp3" },
  });
});

test("warns before deleting an asset that is still used", async () => {
  renderScreen();
  const actions = await screen.findByRole("button", { name: "Actions pour Carte du monde.png" });

  fireEvent.keyDown(actions, { key: "Delete" });
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("image principale du monde « Aldoria »");
  expect(alert.textContent).toContain("image de la carte « Aelin »");
  expect(alert.textContent).toContain("bloc image de la carte « Rowan » (à la corbeille)");
  fireEvent.click(screen.getByRole("button", { name: "Supprimer quand même" }));

  await waitFor(() => expect(screen.queryByText("Carte du monde.png")).toBeNull());
  expect(calls.some((call) => call.command === "delete_asset")).toBe(true);
});

test("deletes an unused asset without a usage warning", async () => {
  renderScreen();
  const actions = await screen.findByRole("button", { name: "Actions pour Taverne.mp3" });

  fireEvent.keyDown(actions, { key: "Delete" });
  const confirm = await screen.findByRole("button", { name: "Supprimer" });
  await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(confirm);

  await waitFor(() => expect(screen.queryByText("Taverne.mp3")).toBeNull());
});
