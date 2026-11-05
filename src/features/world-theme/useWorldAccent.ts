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
  useEffect(() => {
    const style = document.documentElement.style;
    if (accent === null) {
      for (const variable of Object.values(VARIABLES)) style.removeProperty(variable);
      return;
    }
    const light = accentFor(accentOf(accent, "light"), "light");
    const dark = accentFor(accentOf(accent, "dark"), "dark");
    style.setProperty(VARIABLES.light, light);
    style.setProperty(VARIABLES.dark, dark);
    style.setProperty(VARIABLES.lightForeground, foregroundOn(light));
    style.setProperty(VARIABLES.darkForeground, foregroundOn(dark));
    return () => {
      for (const variable of Object.values(VARIABLES)) style.removeProperty(variable);
    };
  }, [accent]);
}
