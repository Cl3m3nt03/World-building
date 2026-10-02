import type { GraphSettings } from "@/lib/bindings";

/** Every setting of a graph, with a value (the Rust side reads them tolerantly). */
export type Settings = { [Key in keyof GraphSettings]-?: NonNullable<GraphSettings[Key]> };

/** The defaults of the Rust side (src-tauri/src/domain/graphs.rs). */
export const DEFAULT_SETTINGS: Settings = {
  showLabels: true,
  hideIsolated: false,
  nodeSize: 1,
  linkDistance: 60,
  linkStrength: 0.5,
  repulsion: 120,
  collision: 1,
  gravityX: 0.05,
  gravityY: 0.05,
};

/** `settings` with a value for each one (the default where it lacks). */
export function resolveSettings(settings: GraphSettings): Settings {
  const resolved = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const value = settings[key];
    if (value !== null && value !== undefined) (resolved as Record<string, unknown>)[key] = value;
  }
  return resolved;
}
