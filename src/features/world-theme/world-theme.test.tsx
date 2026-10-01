// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { useUiStore } from "@/app/stores/ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppSettings, Asset, WorldInfo, WorldTheme } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { accentFor, contrast, foregroundOn, isHexColor, MIN_CONTRAST } from "./accent";
import { findPreset, PRESETS, resolveTheme } from "./presets";

test("an accent is kept when readable, else adjusted just enough for each mode", () => {
  // The default ochre is readable in both modes as it is.
  expect(accentFor("#c8912e", "dark")).toBe("#c8912e");
  // A pale color is darkened on the light background, and stays in the dark mode.
  const pale = "#f4e27a";
  const light = accentFor(pale, "light");
  expect(light).not.toBe(pale);
  expect(contrast(light, "#f5efe3")).toBeGreaterThanOrEqual(MIN_CONTRAST);
  expect(accentFor(pale, "dark")).toBe(pale);
  // A deep color is lightened on the dark background.
  const deep = accentFor("#1b2a6b", "dark");
  expect(contrast(deep, "#0b0e17")).toBeGreaterThanOrEqual(MIN_CONTRAST);
  // Every shipped accent ends up readable in both modes.
  for (const preset of PRESETS) {
    expect(contrast(accentFor(preset.accent, "light"), "#f5efe3")).toBeGreaterThanOrEqual(3);
    expect(contrast(accentFor(preset.accent, "dark"), "#0b0e17")).toBeGreaterThanOrEqual(3);
  }
});

test("text on the accent is the more readable of dark and light", () => {
  expect(foregroundOn("#c8912e")).toBe("#1a1206");
  expect(foregroundOn("#2b62b8")).toBe("#fffaf0");
  expect(isHexColor("#A1b2C3")).toBe(true);
  expect(isHexColor("a1b2c3")).toBe(false);
});

test("a theme resolves to its background and accent", () => {
  const dawn = findPreset("dawn");
  expect(resolveTheme({ kind: "default" }, "main.png")).toEqual({
    presetImage: null,
    backgroundAsset: "main.png",
    accent: null,
  });
  expect(resolveTheme({ kind: "preset", id: "dawn" }, "main.png")).toEqual({
    presetImage: dawn?.image,
    backgroundAsset: null,
    accent: dawn?.accent,
  });
  // A theme from a newer app shows as the default one.
  expect(resolveTheme({ kind: "preset", id: "aurora" }, null).accent).toBeNull();
  // A custom theme without its own image shows the main image.
  expect(
    resolveTheme({ kind: "custom", background: null, accent: "#5fcdc0" }, "main.png"),
  ).toMatchObject({ backgroundAsset: "main.png", accent: "#5fcdc0" });
});

// --- The theme section, in the app ------------------------------------------

const IMAGE: Asset = {
  id: `${"a".repeat(64)}.png`,
  name: "Carte du monde.png",
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
  theme: { kind: "default" },
  preferences: { entityDetection: true, autoMentionLinks: true, animateNewLinks: true },
  storageLimit: null,
  path: "C:\\Mondes\\Aldoria",
  schemaVersion: 6,
  createdAt: "2026-09-26T10:00:00Z",
  lastOpenedAt: "2026-09-26T10:00:00Z",
};

const SETTINGS: AppSettings = {
  preferences: {
    language: "fr",
    theme: "system",
    transparencyEffects: true,
    radioVolume: 70,
    radioMode: "loop",
  },
  recentWorlds: [],
  defaultWorldsDir: null,
};

let world: WorldInfo;
let saved: WorldTheme[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  useUiStore.setState({ worldSettings: null, cardTypesOpen: false });
  world = { ...WORLD };
  saved = [];
  mockIPC((command, payload) => {
    switch (command) {
      case "current_world":
        return world;
      case "get_settings":
        return SETTINGS;
      case "list_assets":
        return [IMAGE];
      case "list_card_types":
      case "recent_documents":
      case "count_cards_by_type":
      case "list_cards":
        return [];
      case "set_world_theme": {
        const { theme } = payload as { theme: WorldTheme };
        saved.push(theme);
        world = { ...world, theme };
        return world;
      }
      default:
        return null;
    }
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("style");
});

async function renderThemeSection() {
  const queryClient = createQueryClient();
  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: [`/world/${WORLD.id}/home`] }),
  );
  await act(async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await router.load();
  });
  act(() => useUiStore.getState().openWorldSettings("theme"));
  return screen.findByRole("dialog", { name: "Réglages du monde" });
}

const backdrop = () => document.querySelector("div[aria-hidden] > img");
const accentVariable = (mode: "light" | "dark") =>
  document.documentElement.style.getPropertyValue(`--bz-world-accent-${mode}`);

test("choosing a shipped theme changes the background and the accent at once", async () => {
  const dialog = await renderThemeSection();
  const gallery = within(dialog).getByRole("radiogroup", { name: "Thèmes" });
  expect(
    within(gallery).getByRole("radio", { name: "Par défaut" }).getAttribute("aria-checked"),
  ).toBe("true");

  fireEvent.click(within(gallery).getByRole("radio", { name: "Forêt ancienne" }));

  const forest = findPreset("forest");
  await waitFor(() => expect(backdrop()?.getAttribute("src")).toBe(forest?.image));
  expect(accentVariable("dark")).toBe(accentFor(forest?.accent ?? "", "dark"));
  expect(accentVariable("light")).toBe(accentFor(forest?.accent ?? "", "light"));
  expect(saved).toEqual([{ kind: "preset", id: "forest" }]);

  // Back to the default theme: the default accents come back.
  fireEvent.click(within(gallery).getByRole("radio", { name: "Par défaut" }));
  await waitFor(() => expect(accentVariable("dark")).toBe(""));
  expect(saved.at(-1)).toEqual({ kind: "default" });
});

test("the edit tab makes the world's own theme from the current accent", async () => {
  world = { ...WORLD, theme: { kind: "preset", id: "sea" } };
  const dialog = await renderThemeSection();

  fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "Modifier" }));
  const swatches = await within(dialog).findByRole("radiogroup", { name: "Couleurs proposées" });
  // The sea accent is offered as the teal swatch.
  expect(
    within(swatches).getByRole("radio", { name: "Sarcelle" }).getAttribute("aria-checked"),
  ).toBe("true");

  fireEvent.click(within(swatches).getByRole("radio", { name: "Violet" }));

  await waitFor(() =>
    expect(saved.at(-1)).toEqual({ kind: "custom", background: null, accent: "#b39af5" }),
  );
  expect(within(dialog).getByText("Ce monde utilise son propre thème.")).toBeTruthy();
});

test("a background is chosen in the media library, and the main image taken back", async () => {
  world = { ...WORLD, theme: { kind: "custom", background: null, accent: "#c8912e" } };
  const dialog = await renderThemeSection();

  fireEvent.click(
    await within(dialog).findByRole("button", { name: "Choisir dans la médiathèque" }),
  );
  fireEvent.doubleClick(await screen.findByRole("option", { name: "Carte du monde.png" }));

  await waitFor(() =>
    expect(saved.at(-1)).toEqual({ kind: "custom", background: IMAGE.id, accent: "#c8912e" }),
  );
  await waitFor(() =>
    expect(backdrop()?.getAttribute("src")).toBe(`http://bzasset.localhost/${IMAGE.id}`),
  );

  fireEvent.click(within(dialog).getByRole("button", { name: "Reprendre l'image principale" }));
  await waitFor(() =>
    expect(saved.at(-1)).toEqual({ kind: "custom", background: null, accent: "#c8912e" }),
  );
});

test("a free color shows at once and is saved once the drag settles", async () => {
  world = { ...WORLD, theme: { kind: "custom", background: null, accent: "#c8912e" } };
  const dialog = await renderThemeSection();
  const picker = await within(dialog).findByLabelText(/Couleur libre/);

  fireEvent.change(picker, { target: { value: "#224488" } });
  fireEvent.change(picker, { target: { value: "#2255aa" } });

  await waitFor(() => expect(accentVariable("dark")).toBe(accentFor("#2255aa", "dark")));
  expect(saved).toEqual([]);
  await waitFor(() =>
    expect(saved).toEqual([{ kind: "custom", background: null, accent: "#2255aa" }]),
  );
});
