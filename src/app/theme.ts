import { useCallback, useEffect, useState } from "react";

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

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
}

export function applyTransparency(transparency: TransparencyPreference): void {
  document.documentElement.dataset.transparency = transparency;
}

/**
 * Theme preference, applied to <html data-theme>. Follows the OS by default.
 * Kept in component state for now: the UI store arrives in 0.7 and persistence
 * in the app settings (config dir) in 0.9.
 */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme("system", systemPrefersDark()),
  );

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const update = () => {
      const next = resolveTheme(preference, query.matches);
      applyTheme(next);
      setResolved(next);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [preference]);

  return { preference, resolved, setPreference };
}

export function useTransparency() {
  const [transparency, setTransparencyState] = useState<TransparencyPreference>("on");

  const setTransparency = useCallback((next: TransparencyPreference) => {
    applyTransparency(next);
    setTransparencyState(next);
  }, []);

  return { transparency, setTransparency };
}

/** Sets the initial theme before the first render to avoid a flash. */
export function initTheme(): void {
  applyTheme(resolveTheme("system", systemPrefersDark()));
  applyTransparency("on");
}
