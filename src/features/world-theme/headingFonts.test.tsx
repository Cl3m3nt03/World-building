// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { WorldInfo, WorldTheme } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { loadHeadingFont, themeHeadingFont } from "./headingFonts";
import { useWorldHeadingFont } from "./useWorldHeadingFont";

const CUSTOM: WorldTheme = { kind: "custom", background: null, accent: "#5fcdc0" };

test("a theme's heading font: the custom one's, else Alegreya", () => {
  expect(themeHeadingFont({ kind: "default" })).toBe("alegreya");
  expect(themeHeadingFont({ kind: "preset", id: "dawn" })).toBe("alegreya");
  expect(themeHeadingFont(CUSTOM)).toBe("alegreya");
  expect(themeHeadingFont({ ...CUSTOM, headingFont: "oxanium" })).toBe("oxanium");
  // A font from a newer app, or a key of Object's prototype, shows as Alegreya.
  for (const unknown of ["comicSans", "toString"])
    expect(themeHeadingFont({ ...CUSTOM, headingFont: unknown } as unknown as WorldTheme)).toBe(
      "alegreya",
    );
});

test("a world waits for its heading font, never longer than a moment", async () => {
  vi.useFakeTimers();
  const load = vi.fn(() => new Promise<FontFace[]>(() => undefined));
  const check = vi.fn(() => false);
  Object.defineProperty(document, "fonts", { value: { load, check }, configurable: true });
  try {
    let done = false;
    void loadHeadingFont("cinzel").then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(299);
    expect(done).toBe(false);
    expect(load).toHaveBeenCalledWith('700 1em "Cinzel Variable"');
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    // Alegreya, the app's own, is never waited for.
    load.mockClear();
    await loadHeadingFont("alegreya");
    expect(load).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
    Reflect.deleteProperty(document, "fonts");
  }
});

// --- On <html> -------------------------------------------------------------

function Probe() {
  useWorldHeadingFont();
  return null;
}

async function renderWith(theme: WorldTheme | null) {
  const world = { id: "0b6c3f5e-8d1a-4c1b-9d4e-2f0a7b3c5d6e", name: "Aldoria", theme };
  mockIPC((command) =>
    command === "current_world" ? (theme ? (world as unknown as WorldInfo) : null) : null,
  );
  return act(async () =>
    render(
      <QueryClientProvider client={createQueryClient()}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
}

afterEach(() => {
  cleanup();
  clearMocks();
});

const root = document.documentElement;

test("a world in Cinzel marks <html>, and leaving it clears the mark", async () => {
  const view = await renderWith({ ...CUSTOM, headingFont: "cinzel" });
  await waitFor(() => expect(root.dataset.headingFont).toBe("cinzel"));
  view.unmount();
  expect(root.dataset.headingFont).toBeUndefined();
});

test("Alegreya, an unknown font or no world sets nothing", async () => {
  for (const theme of [
    CUSTOM,
    { ...CUSTOM, headingFont: "comicSans" } as unknown as WorldTheme,
    null,
  ]) {
    await renderWith(theme);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(root.dataset.headingFont).toBeUndefined();
    cleanup();
  }
});
