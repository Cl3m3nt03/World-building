// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from "node:fs";
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { Material, WorldInfo, WorldTheme } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { accentFor, contrast, foregroundOn, type Mode, VELLUM_GROUNDS } from "./accent";
import { grounds, MATERIAL_COLORS, MATERIALS, materialAccent } from "./materials";
import { ACCENT_SWATCHES, accentOf, PRESETS } from "./presets";
import { themeLook, useWorldMaterial } from "./useWorldMaterial";

const MODES: readonly Mode[] = ["light", "dark"];
/** A stylesheet of src/styles, line endings made LF. */
const css = (name: string) => readFileSync(`src/styles/${name}`, "utf8").replaceAll("\r\n", "\n");

/** The custom properties of the first rule whose selector is exactly `selector`. */
function block(source: string, selector: string): Record<string, string> {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule ${selector}`);
  const body = source.slice(source.indexOf("{", start) + 1, source.indexOf("}", start));
  const entries = [...body.matchAll(/(--bz-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]?.trim()]);
  return Object.fromEntries(entries);
}

function cssColors(material: Material, mode: Mode): Record<string, string> {
  if (material === "vellum") {
    const tokens = css("tokens.css");
    const light = block(
      tokens,
      ':root,\n[data-wiki-scheme="light"],\n[data-quill-scheme="light"],\n[data-scheme="light"]',
    );
    if (mode === "light") return light;
    return {
      ...light,
      ...block(
        tokens,
        '[data-theme="dark"],\n[data-wiki-scheme="dark"],\n[data-quill-scheme="dark"],\n[data-scheme="dark"]',
      ),
    };
  }
  const selector = `:root[data-material="${material}"]`;
  return block(
    css("materials.css"),
    mode === "light" ? selector : `${selector}[data-theme="dark"]`,
  );
}

describe.each(MATERIALS)("the %s material", (material) => {
  test.each(MODES)("in %s mode, its colours are those of the CSS", (mode) => {
    const colors = MATERIAL_COLORS[material][mode];
    const declared = cssColors(material, mode);
    expect(declared["--bz-bg"]).toBe(colors.bg);
    expect(declared["--bz-surface"]).toBe(colors.surface);
    expect(declared["--bz-surface-strong"]).toBe(colors.surfaceStrong);
    expect(declared["--bz-text"]).toBe(colors.text);
    expect(declared["--bz-text-muted"]).toBe(colors.textMuted);
    expect(declared["--bz-accent"]).toContain(colors.accent);
  });

  test.each(MODES)("in %s mode, text, muted text and every accent are readable", (mode) => {
    const colors = MATERIAL_COLORS[material][mode];
    const on = grounds(colors);
    for (const ground of on) {
      expect(contrast(colors.text, ground)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.textMuted, ground)).toBeGreaterThanOrEqual(4.5);
    }
    // The material's own accent and each of the ten offered ones, as shown.
    for (const offered of [null, ...ACCENT_SWATCHES.map((swatch) => swatch.color)]) {
      const { accent, foreground } =
        material === "vellum" && offered !== null
          ? { accent: accentFor(offered, mode), foreground: foregroundOn(accentFor(offered, mode)) }
          : materialAccent(offered, material, mode);
      for (const ground of on) expect(contrast(accent, ground)).toBeGreaterThanOrEqual(3);
      expect(contrast(foreground, accent)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

test("each ambiance shows its accents as given, readable on its material", () => {
  const ambiances = PRESETS.filter((preset) => preset.look);
  expect(ambiances.map((preset) => preset.id)).toEqual(["grimoire", "station", "crypt"]);
  for (const preset of ambiances) {
    const material = preset.look?.material ?? "vellum";
    for (const mode of MODES) {
      const given = accentOf(preset.accent, mode);
      const { accent, foreground } = materialAccent(preset.accent, material, mode);
      // Picked readable from the mock-ups, so never adjusted.
      expect(accent, `${preset.id} ${mode}`).toBe(given);
      for (const ground of grounds(MATERIAL_COLORS[material][mode]))
        expect(contrast(accent, ground)).toBeGreaterThanOrEqual(3);
      expect(contrast(foreground, accent)).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("the Vélin grounds of the accent are those of tokens.css", () => {
  for (const mode of MODES)
    expect(VELLUM_GROUNDS[mode]).toEqual(grounds(MATERIAL_COLORS.vellum[mode]));
});

test("a theme's look: the custom one's fields, else Vélin without ornament", () => {
  expect(themeLook({ kind: "default" })).toEqual({ material: "vellum", ornament: "none" });
  expect(themeLook({ kind: "preset", id: "dawn" })).toEqual({
    material: "vellum",
    ornament: "none",
  });
  // The three ambiances bring their own; an ambiance from a newer app shows as the default.
  expect(themeLook({ kind: "preset", id: "grimoire" })).toEqual({
    material: "parchment",
    ornament: "rules",
  });
  expect(themeLook({ kind: "preset", id: "station" })).toEqual({
    material: "coldGlass",
    ornament: "marks",
  });
  expect(themeLook({ kind: "preset", id: "crypt" })).toEqual({
    material: "stone",
    ornament: "edge",
  });
  expect(themeLook({ kind: "preset", id: "aurora" })).toEqual({
    material: "vellum",
    ornament: "none",
  });
  const custom: WorldTheme = { kind: "custom", background: null, accent: "#5fcdc0" };
  expect(themeLook(custom)).toEqual({ material: "vellum", ornament: "none" });
  expect(themeLook({ ...custom, material: "stone", ornament: "edge" })).toEqual({
    material: "stone",
    ornament: "edge",
  });
  // A value from a newer app shows as the default.
  const newer = { ...custom, material: "obsidian", ornament: "runes" } as unknown as WorldTheme;
  expect(themeLook(newer)).toEqual({ material: "vellum", ornament: "none" });
});

// --- On <html> -------------------------------------------------------------

const WORLD = {
  id: "0b6c3f5e-8d1a-4c1b-9d4e-2f0a7b3c5d6e",
  name: "Aldoria",
  theme: { kind: "default" },
} as unknown as WorldInfo;

function Probe() {
  useWorldMaterial();
  return null;
}

async function renderWith(theme: WorldTheme | null) {
  mockIPC((command) => (command === "current_world" ? (theme ? { ...WORLD, theme } : null) : null));
  const queryClient = createQueryClient();
  const view = await act(async () =>
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
  return { view, queryClient };
}

afterEach(() => {
  cleanup();
  clearMocks();
  document.documentElement.removeAttribute("style");
});

const root = document.documentElement;

test("a world in stone with the edge ornament marks <html>, with its own accent", async () => {
  const { view } = await renderWith({
    kind: "custom",
    background: null,
    accent: "#5fcdc0",
    material: "stone",
    ornament: "edge",
  });
  await waitFor(() => expect(root.dataset.material).toBe("stone"));
  expect(root.dataset.ornament).toBe("edge");
  expect(root.style.getPropertyValue("--bz-material-accent-light")).toBe(
    materialAccent("#5fcdc0", "stone", "light").accent,
  );
  // Leaving it (the world closes) clears everything.
  view.unmount();
  expect(root.dataset.material).toBeUndefined();
  expect(root.dataset.ornament).toBeUndefined();
  expect(root.style.getPropertyValue("--bz-material-accent-light")).toBe("");
});

test("Vélin without ornament, or no world, sets nothing on <html>", async () => {
  await renderWith({ kind: "custom", background: null, accent: "#5fcdc0" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(root.dataset.material).toBeUndefined();
  expect(root.dataset.ornament).toBeUndefined();
  expect(root.getAttribute("style")).toBeNull();
  cleanup();
  await renderWith(null);
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(root.dataset.material).toBeUndefined();
});
