// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Backdrop } from "@/app/shell/Backdrop";
import type { Asset, WorldInfo, WorldPatch } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { worldKeys } from "../hooks/keys";
import { useCurrentWorld } from "../hooks/useWorlds";
import { WorldPanel } from "./WorldPanel";

const IMAGE: Asset = {
  id: `${"a".repeat(64)}.png`,
  name: "Aldoria.png",
  kind: "image",
  mime: "image/png",
  size: 1024,
  width: 64,
  height: 64,
  createdAt: "2026-09-26T10:00:00Z",
};

const WORLD: WorldInfo = {
  id: "0b6c3f5e-8d1a-4c1b-9d4e-2f0a7b3c5d6e",
  name: "Aldoria",
  genre: "fantasy",
  description: "",
  mainImage: null,
  path: "C:\\Mondes\\Aldoria",
  schemaVersion: 1,
  createdAt: "2026-09-26T10:00:00Z",
  lastOpenedAt: "2026-09-26T10:00:00Z",
};

type Call = { command: string; payload: unknown };
let calls: Call[];
let world: WorldInfo;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  calls = [];
  world = { ...WORLD };
  mockIPC((command, payload) => {
    calls.push({ command, payload });
    if (command === "current_world") return world;
    if (command === "get_settings") {
      return { preferences: {}, recentWorlds: [], defaultWorldsDir: null };
    }
    if (command === "list_assets") return [IMAGE];
    if (command === "update_world") {
      const { patch } = payload as { patch: WorldPatch };
      world = {
        ...world,
        name: patch.name ?? world.name,
        genre: patch.genre ?? world.genre,
        description: patch.description ?? world.description,
      };
      return world;
    }
    if (command === "set_world_main_image") {
      world = { ...world, mainImage: (payload as { assetId: string | null }).assetId };
      return world;
    }
    return null;
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

let queryClient: ReturnType<typeof createQueryClient>;

/** The panel, fed by the current world query like in the top bar. */
function ConnectedPanel() {
  const { data } = useCurrentWorld();
  return data ? <WorldPanel world={data} open onOpenChange={() => {}} /> : null;
}

function renderPanel() {
  queryClient = createQueryClient();
  queryClient.setQueryData(worldKeys.current(), world);
  render(
    <QueryClientProvider client={queryClient}>
      <Backdrop />
      <ConnectedPanel />
    </QueryClientProvider>,
  );
}

const updates = () => calls.filter((call) => call.command === "update_world");

test("saves the name after typing, without a button", async () => {
  renderPanel();

  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Aldoria II" } });

  await waitFor(() =>
    expect(updates()).toContainEqual({
      command: "update_world",
      payload: { patch: { name: "Aldoria II" } },
    }),
  );
});

test("never saves an empty name", async () => {
  renderPanel();

  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "  " } });

  expect(screen.getByText(/Le nom ne peut pas être vide/)).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 700));
  expect(updates()).toHaveLength(0);
});

test("saves the description", async () => {
  renderPanel();

  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Un royaume du nord." },
  });

  await waitFor(() =>
    expect(updates()).toContainEqual({
      command: "update_world",
      payload: { patch: { description: "Un royaume du nord." } },
    }),
  );
});

test("sets the main image through the picker, which becomes the backdrop", async () => {
  renderPanel();

  fireEvent.click(screen.getByRole("button", { name: "Choisir une image" }));
  fireEvent.doubleClick(await screen.findByRole("option", { name: "Aldoria.png" }));

  await waitFor(() =>
    expect(calls).toContainEqual({
      command: "set_world_main_image",
      payload: { assetId: IMAGE.id },
    }),
  );
  await screen.findByRole("button", { name: "Changer d'image" });
  const backdrop = document.querySelector("div[aria-hidden] > img");
  expect(backdrop?.getAttribute("src")).toBe(`http://bzasset.localhost/${IMAGE.id}`);
});
