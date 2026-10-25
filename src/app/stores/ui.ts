import { create } from "zustand";
import type { ThemePreference, TransparencyPreference } from "@/app/theme";
import type { RadioMode } from "@/lib/bindings";

export const SIDEBAR_WIDTH = { default: 280, min: 200, max: 480 } as const;

/** Sections of the world settings screen. */
export const WORLD_SETTINGS_SECTIONS = [
  "general",
  "types",
  "media",
  "theme",
  "calendar",
  "preferences",
] as const;
export type WorldSettingsSection = (typeof WORLD_SETTINGS_SECTIONS)[number];

type UiState = {
  theme: ThemePreference;
  transparency: TransparencyPreference;
  /** Sidebar width in pixels, kept across tab switches. */
  setTheme: (theme: ThemePreference) => void;
  setTransparency: (transparency: TransparencyPreference) => void;
  /** Radio volume (0–100) and mode, saved in the app settings. */
  radioVolume: number;
  radioMode: RadioMode;
  setRadioVolume: (volume: number) => void;
  setRadioMode: (mode: RadioMode) => void;
  /** The world rail (V2-2+.1), shown or folded; saved in the app settings. */
  worldRail: boolean;
  setWorldRail: (shown: boolean) => void;
  /** The « New world » dialog, opened from the world list or the rail. */
  createWorldOpen: boolean;
  setCreateWorldOpen: (open: boolean) => void;
  /**
   * World settings screen (top bar, and "Settings" on the Home tab): the
   * section shown, or `null` when closed.
   */
  worldSettings: WorldSettingsSection | null;
  openWorldSettings: (section?: WorldSettingsSection) => void;
  closeWorldSettings: () => void;
  /** Card types screen (Home › Types, and "New type" when creating a card). */
  cardTypesOpen: boolean;
  setCardTypesOpen: (open: boolean) => void;
  /** A card just created: its page opens with the title selected. */
  focusCardTitle: string | null;
  setFocusCardTitle: (cardId: string | null) => void;
  /** Bumped by Ctrl+K: the sidebar's search field takes the focus. */
  searchRequest: number;
  requestSearch: () => void;
};

/**
 * UI-only state (never world data, see CLAUDE.md). Theme and transparency are
 * saved in the app settings (features/settings); the sidebar's state per world
 * in the world (features/sidebar, ADR 0005).
 */
export const useUiStore = create<UiState>()((set) => ({
  theme: "system",
  transparency: "on",
  setTheme: (theme) => set({ theme }),
  setTransparency: (transparency) => set({ transparency }),
  radioVolume: 70,
  radioMode: "loop",
  setRadioVolume: (volume) => {
    if (Number.isFinite(volume)) {
      set({ radioVolume: Math.round(Math.min(100, Math.max(0, volume))) });
    }
  },
  setRadioMode: (radioMode) => set({ radioMode }),
  worldRail: false,
  setWorldRail: (worldRail) => set({ worldRail }),
  createWorldOpen: false,
  setCreateWorldOpen: (createWorldOpen) => set({ createWorldOpen }),
  worldSettings: null,
  openWorldSettings: (section = "general") => set({ worldSettings: section }),
  closeWorldSettings: () => set({ worldSettings: null }),
  cardTypesOpen: false,
  setCardTypesOpen: (cardTypesOpen) => set({ cardTypesOpen }),
  focusCardTitle: null,
  setFocusCardTitle: (focusCardTitle) => set({ focusCardTitle }),
  searchRequest: 0,
  requestSearch: () => set((state) => ({ searchRequest: state.searchRequest + 1 })),
}));
