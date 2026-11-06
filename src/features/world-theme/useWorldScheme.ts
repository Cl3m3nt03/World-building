import { useRouterState } from "@tanstack/react-router";
import { useRef } from "react";
import { type ResolvedTheme, useImposedTheme } from "@/app/theme";
import { useCurrentWorld } from "@/features/world";
import type { WorldTheme } from "@/lib/bindings";
import { findPreset } from "./presets";

/**
 * The mode `theme` imposes: « Toujours clair » or « Toujours sombre » of a
 * custom theme, the one of an ambiance that has one (Crypte, always dark),
 * else none (« Suivre l'app », the other shipped themes, or a value saved by
 * a newer app).
 */
export function themeScheme(theme: WorldTheme): ResolvedTheme | null {
  if (theme.kind === "preset") return findPreset(theme.id)?.look?.scheme ?? null;
  if (theme.kind !== "custom") return null;
  return theme.scheme === "light" || theme.scheme === "dark" ? theme.scheme : null;
}

/**
 * Imposes the open world's mode over the app's while one of its pages is on
 * screen (ADR 0015). It follows the world whose page is shown, not the one
 * just opened or closed: switching worlds or going back to the world list
 * changes the mode in the same frame as the page, never before it.
 */
export function useWorldScheme(): void {
  const { data: world } = useCurrentWorld();
  const shownId = useRouterState({
    select: (state) =>
      state.matches.find((match) => match.routeId === "/world/$worldId")?.params.worldId ?? null,
  });
  const shown = useRef<{ id: string; scheme: ResolvedTheme | null } | null>(null);
  if (world && world.id === shownId)
    shown.current = { id: world.id, scheme: themeScheme(world.theme) };
  useImposedTheme(shownId !== null && shown.current?.id === shownId ? shown.current.scheme : null);
}
