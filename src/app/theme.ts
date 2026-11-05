import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
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

/** The app's own mode (its preference), and the one an open world imposes over it (ADR 0015). */
let preferred: ResolvedTheme = "light";
let imposed: ResolvedTheme | null = null;
/** How many app screens (the app settings) show the app's own mode over an imposed one. */
let lifted = 0;
const imposedListeners = new Set<() => void>();

function applyTheme(theme: ResolvedTheme): void {
  preferred = theme;
  renderTheme();
}

function renderTheme(): void {
  document.documentElement.dataset.theme = lifted > 0 ? preferred : (imposed ?? preferred);
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

function readTheme(): ResolvedTheme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** The theme shown now (for components that draw their own colours: the canvas). */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribeTheme, readTheme, () => "light");
}

/**
 * Imposes `theme` over the app's preference while mounted (an open world's
 * mode, ADR 0015); null imposes nothing. Set before the browser paints, so
 * the change never shows a frame in the other mode.
 */
export function useImposedTheme(theme: ResolvedTheme | null): void {
  useLayoutEffect(() => {
    if (theme === null) return;
    setImposed(theme);
    return () => setImposed(null);
  }, [theme]);
}

function setImposed(theme: ResolvedTheme | null): void {
  imposed = theme;
  renderTheme();
  for (const listener of imposedListeners) listener();
}

function subscribeImposed(onChange: () => void): () => void {
  imposedListeners.add(onChange);
  return () => imposedListeners.delete(onChange);
}

/** The mode the open world imposes, or null (for the app settings to say so). */
export function useImposedThemeValue(): ResolvedTheme | null {
  return useSyncExternalStore(
    subscribeImposed,
    () => imposed,
    () => null,
  );
}

/** While `active`, shows the app's own mode over an imposed one (the app settings). */
export function useAppTheme(active: boolean): void {
  useLayoutEffect(() => {
    if (!active) return;
    lifted += 1;
    renderTheme();
    return () => {
      lifted -= 1;
      renderTheme();
    };
  }, [active]);
}
