import { useEffect } from "react";
import { useCurrentWorld } from "@/features/world";
import type { Material, Ornament, WorldTheme } from "@/lib/bindings";
import { MATERIALS, materialAccent, ORNAMENTS } from "./materials";
import { findPreset, resolveTheme } from "./presets";

/** CSS variables read by materials.css for the accent of a material. */
const VARIABLES = {
  light: "--bz-material-accent-light",
  dark: "--bz-material-accent-dark",
  lightForeground: "--bz-material-accent-foreground-light",
  darkForeground: "--bz-material-accent-foreground-dark",
} as const;

/**
 * The material and ornament of `theme`. A shipped theme has its ambiance's
 * (Grimoire, Station, Crypte), else Vélin without ornament; a value this app
 * does not know (saved by a newer one) shows as the default.
 */
export function themeLook(theme: WorldTheme): { material: Material; ornament: Ornament } {
  if (theme.kind === "preset") {
    const look = findPreset(theme.id)?.look;
    return look
      ? { material: look.material, ornament: look.ornament }
      : { material: "vellum", ornament: "none" };
  }
  if (theme.kind !== "custom") return { material: "vellum", ornament: "none" };
  const material = MATERIALS.includes(theme.material as Material) ? theme.material : undefined;
  const ornament = ORNAMENTS.includes(theme.ornament as Ornament) ? theme.ornament : undefined;
  return { material: material ?? "vellum", ornament: ornament ?? "none" };
}

/**
 * Puts the open world's material and ornament on <html data-material> and
 * <html data-ornament>, with the accent recomputed for the material. Vélin
 * and « Aucun » set nothing, so the app looks as without a rich theme; with
 * no world open, nothing is set either.
 */
export function useWorldMaterial(): void {
  const { data: world } = useCurrentWorld();
  const { material, ornament } = world
    ? themeLook(world.theme)
    : { material: "vellum" as const, ornament: "none" as const };
  const accent = world ? resolveTheme(world.theme, null).accent : null;

  useEffect(() => {
    const root = document.documentElement;
    if (material === "vellum") return;
    const light = materialAccent(accent, material, "light");
    const dark = materialAccent(accent, material, "dark");
    root.style.setProperty(VARIABLES.light, light.accent);
    root.style.setProperty(VARIABLES.dark, dark.accent);
    root.style.setProperty(VARIABLES.lightForeground, light.foreground);
    root.style.setProperty(VARIABLES.darkForeground, dark.foreground);
    root.dataset.material = material;
    return () => {
      delete root.dataset.material;
      for (const variable of Object.values(VARIABLES)) root.style.removeProperty(variable);
    };
  }, [material, accent]);

  useEffect(() => {
    if (ornament === "none") return;
    const root = document.documentElement;
    root.dataset.ornament = ornament;
    return () => {
      delete root.dataset.ornament;
    };
  }, [ornament]);
}
