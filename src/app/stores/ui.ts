import { create } from "zustand";
import type { ThemePreference, TransparencyPreference } from "@/app/theme";

export const SIDEBAR_WIDTH = { default: 280, min: 200, max: 480 } as const;

type UiState = {
  theme: ThemePreference;
  transparency: TransparencyPreference;
  /** Sidebar width in pixels, kept across tab switches. */
  sidebarWidth: number;
  setTheme: (theme: ThemePreference) => void;
  setTransparency: (transparency: TransparencyPreference) => void;
  setSidebarWidth: (width: number) => void;
};

/**
 * UI-only state (never world data, see CLAUDE.md). Theme and transparency are
 * persisted in the app settings in 0.9; the sidebar width per world in M3.
 */
export const useUiStore = create<UiState>()((set) => ({
  theme: "system",
  transparency: "on",
  sidebarWidth: SIDEBAR_WIDTH.default,
  setTheme: (theme) => set({ theme }),
  setTransparency: (transparency) => set({ transparency }),
  setSidebarWidth: (width) =>
    set({ sidebarWidth: Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, width)) }),
}));
