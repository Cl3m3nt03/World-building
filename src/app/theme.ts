import { useEffect } from "react";
import { useUiStore } from "@/app/stores/ui";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type TransparencyPreference = "on" | "off";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }
  return preference;
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
}

function applyTransparency(transparency: TransparencyPreference): void {
  document.documentElement.dataset.transparency = transparency;
}

/** Sets the initial theme before the first render to avoid a flash. */
export function initTheme(): void {
  const { theme, transparency } = useUiStore.getState();
  applyTheme(resolveTheme(theme, systemPrefersDark()));
  applyTransparency(transparency);
}

/**
 * Applies the UI store's theme and transparency to <html data-theme> and
 * <html data-transparency>, and follows OS theme changes in "system" mode.
 */
export function useThemeSync(): void {
  const theme = useUiStore((state) => state.theme);
  const transparency = useUiStore((state) => state.transparency);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const update = () => applyTheme(resolveTheme(theme, query.matches));
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [theme]);

  useEffect(() => {
    applyTransparency(transparency);
  }, [transparency]);
}
