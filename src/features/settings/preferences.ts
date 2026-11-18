import { useEffect } from "react";
import { useUiStore } from "@/app/stores/ui";
import { DEFAULT_LANGUAGE, i18n, isLanguage, type Language } from "@/i18n";
import { commands, type Preferences } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";

/**
 * Loads the saved preferences (app config dir, via Rust) into the UI store,
 * before the first render. Returns the language to start i18n with.
 * Outside Tauri (tests, plain browser) the defaults are kept.
 */
export async function loadPreferences(): Promise<Language> {
  try {
    const { preferences } = await unwrap(commands.getSettings());
    useUiStore.setState({
      theme: preferences.theme,
      transparency: preferences.transparencyEffects ? "on" : "off",
      radioVolume: preferences.radioVolume,
      radioMode: preferences.radioMode,
      worldRail: preferences.worldRail,
      cornerRadius: preferences.cornerRadius,
    });
    return preferences.language;
  } catch (error) {
    console.warn("Cannot load the app settings, using defaults", error);
    return DEFAULT_LANGUAGE;
  }
}

function currentPreferences(): Preferences | undefined {
  const language = i18n.resolvedLanguage ?? i18n.language;
  if (!isLanguage(language)) return undefined;
  const { theme, transparency, radioVolume, radioMode, worldRail, cornerRadius } =
    useUiStore.getState();
  return {
    language,
    theme,
    transparencyEffects: transparency === "on",
    radioVolume,
    radioMode,
    worldRail,
    cornerRadius,
  };
}

/**
 * Volume and corner changes come in bursts while dragging their slider:
 * saved once they settle.
 */
const SLIDER_SAVE_DELAY_MS = 400;

/**
 * Saves the preferences whenever the theme, transparency, corners, language
 * or radio settings change.
 */
export function usePreferencesSync(): void {
  useEffect(() => {
    const save = () => {
      const preferences = currentPreferences();
      if (!preferences) return;
      unwrap(commands.updatePreferences(preferences)).catch((error: unknown) => {
        console.warn("Cannot save the preferences", error);
      });
    };

    let sliderTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useUiStore.subscribe((state, previous) => {
      if (
        state.theme !== previous.theme ||
        state.transparency !== previous.transparency ||
        state.radioMode !== previous.radioMode ||
        state.worldRail !== previous.worldRail
      ) {
        save();
      } else if (
        state.radioVolume !== previous.radioVolume ||
        state.cornerRadius !== previous.cornerRadius
      ) {
        clearTimeout(sliderTimer);
        sliderTimer = setTimeout(save, SLIDER_SAVE_DELAY_MS);
      }
    });
    i18n.on("languageChanged", save);
    return () => {
      clearTimeout(sliderTimer);
      unsubscribe();
      i18n.off("languageChanged", save);
    };
  }, []);
}
