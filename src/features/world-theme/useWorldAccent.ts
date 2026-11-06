import { useEffect } from "react";
import { accentFor, foregroundOn } from "./accent";
import { accentOf, type ThemeAccent } from "./presets";

/** CSS variables read by tokens.css (`--bz-accent` falls back on the default ochre). */
const VARIABLES = {
  light: "--bz-world-accent-light",
  dark: "--bz-world-accent-dark",
  lightForeground: "--bz-world-accent-foreground-light",
  darkForeground: "--bz-world-accent-foreground-dark",
} as const;

/**
 * Applies the accent of the open world's theme to the whole app, with a
 * readable variant per mode; `null` (default theme, no world open) restores
 * the default accents.
 */
export function useWorldAccent(accent: ThemeAccent | null): void {
  // The colors, not the object: a custom theme's is rebuilt at each render.
  const light = accent === null ? null : accentFor(accentOf(accent, "light"), "light");
  const dark = accent === null ? null : accentFor(accentOf(accent, "dark"), "dark");
  useEffect(() => {
    const style = document.documentElement.style;
    if (light === null || dark === null) {
      for (const variable of Object.values(VARIABLES)) style.removeProperty(variable);
      return;
    }
    style.setProperty(VARIABLES.light, light);
    style.setProperty(VARIABLES.dark, dark);
    style.setProperty(VARIABLES.lightForeground, foregroundOn(light));
    style.setProperty(VARIABLES.darkForeground, foregroundOn(dark));
    return () => {
      for (const variable of Object.values(VARIABLES)) style.removeProperty(variable);
    };
  }, [light, dark]);
}
