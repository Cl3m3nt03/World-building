import type { CSSProperties } from "react";
import type { HeadingFont, Material, Ornament, WorldTheme } from "@/lib/bindings";
import { accentFor, foregroundOn } from "./accent";
import { themeHeadingFont } from "./headingFonts";
import { materialAccent } from "./materials";
import { accentOf, resolveTheme } from "./presets";
import { themeLook } from "./useWorldMaterial";

/**
 * What a subtree needs to show `theme` without touching the window's (the
 * theme gallery's preview, ADR 0015): the attributes read by tokens.css,
 * materials.css and fonts.css under `[data-theme-preview]`, and the accent
 * variables the window gets from useWorldAccent and useWorldMaterial.
 * `initial` hides the window's own accent, so a default theme falls back on
 * the default accents.
 */
export type ThemeScope = {
  "data-theme-preview": "";
  "data-material": Material;
  "data-ornament": Ornament;
  "data-heading-font": HeadingFont;
  style: CSSProperties;
};

export function themeScope(theme: WorldTheme): ThemeScope {
  const { material, ornament } = themeLook(theme);
  const accent = resolveTheme(theme, null).accent;
  const style: Record<string, string> = {};
  if (accent === null) {
    for (const mode of ["light", "dark"] as const) {
      style[`--bz-world-accent-${mode}`] = "initial";
      style[`--bz-world-accent-foreground-${mode}`] = "initial";
    }
  } else {
    for (const mode of ["light", "dark"] as const) {
      const shown = accentFor(accentOf(accent, mode), mode);
      style[`--bz-world-accent-${mode}`] = shown;
      style[`--bz-world-accent-foreground-${mode}`] = foregroundOn(shown);
    }
  }
  if (material !== "vellum") {
    for (const mode of ["light", "dark"] as const) {
      const shown = materialAccent(accent, material, mode);
      style[`--bz-material-accent-${mode}`] = shown.accent;
      style[`--bz-material-accent-foreground-${mode}`] = shown.foreground;
    }
  }
  return {
    "data-theme-preview": "",
    "data-material": material,
    "data-ornament": ornament,
    "data-heading-font": themeHeadingFont(theme),
    style: style as CSSProperties,
  };
}
