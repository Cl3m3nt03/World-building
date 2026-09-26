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
  const { theme, transparency, radioVolume, radioMode } = useUiStore.getState();
  return {
    language,
    theme,
    transparencyEffects: transparency === "on",
    radioVolume,
    radioMode,
  };
}

/** Volume changes come in bursts while dragging the slider: saved once it settles. */
const VOLUME_SAVE_DELAY_MS = 400;

/** Saves the preferences whenever the theme, transparency, language or radio settings change. */
export function usePreferencesSync(): void {
  useEffect(() => {
    const save = () => {
      const preferences = currentPreferences();
      if (!preferences) return;
      unwrap(commands.updatePreferences(preferences)).catch((error: unknown) => {
        console.warn("Cannot save the preferences", error);
      });
    };

    let volumeTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useUiStore.subscribe((state, previous) => {
      if (
        state.theme !== previous.theme ||
        state.transparency !== previous.transparency ||
        state.radioMode !== previous.radioMode
      ) {
        save();
      } else if (state.radioVolume !== previous.radioVolume) {
        clearTimeout(volumeTimer);
        volumeTimer = setTimeout(save, VOLUME_SAVE_DELAY_MS);
      }
    });
    i18n.on("languageChanged", save);
    return () => {
      clearTimeout(volumeTimer);
      unsubscribe();
      i18n.off("languageChanged", save);
    };
  }, []);
}
