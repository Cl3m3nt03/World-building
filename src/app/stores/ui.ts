import { create } from "zustand";
import type { ThemePreference, TransparencyPreference } from "@/app/theme";
import type { RadioMode } from "@/lib/bindings";

export const SIDEBAR_WIDTH = { default: 280, min: 200, max: 480 } as const;

type UiState = {
  theme: ThemePreference;
  transparency: TransparencyPreference;
  /** Sidebar width in pixels, kept across tab switches. */
  sidebarWidth: number;
  setTheme: (theme: ThemePreference) => void;
  setTransparency: (transparency: TransparencyPreference) => void;
  setSidebarWidth: (width: number) => void;
  /** Radio volume (0–100) and mode, saved in the app settings. */
  radioVolume: number;
  radioMode: RadioMode;
  setRadioVolume: (volume: number) => void;
  setRadioMode: (mode: RadioMode) => void;
  /** Panel of the open world (top bar, and "Settings" on the Home tab). */
  worldPanelOpen: boolean;
  setWorldPanelOpen: (open: boolean) => void;
  /** Card types screen (Home › Types, and "New type" when creating a card). */
  cardTypesOpen: boolean;
  setCardTypesOpen: (open: boolean) => void;
};

/**
 * UI-only state (never world data, see CLAUDE.md). Theme and transparency are
 * saved in the app settings (features/settings); the sidebar width per world in M3.
 */
export const useUiStore = create<UiState>()((set) => ({
  theme: "system",
  transparency: "on",
  sidebarWidth: SIDEBAR_WIDTH.default,
  setTheme: (theme) => set({ theme }),
  setTransparency: (transparency) => set({ transparency }),
  setSidebarWidth: (width) =>
    set({ sidebarWidth: Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, width)) }),
  radioVolume: 70,
  radioMode: "loop",
  setRadioVolume: (volume) => {
    if (Number.isFinite(volume)) {
      set({ radioVolume: Math.round(Math.min(100, Math.max(0, volume))) });
    }
  },
  setRadioMode: (radioMode) => set({ radioMode }),
  worldPanelOpen: false,
  setWorldPanelOpen: (worldPanelOpen) => set({ worldPanelOpen }),
  cardTypesOpen: false,
  setCardTypesOpen: (cardTypesOpen) => set({ cardTypesOpen }),
}));
