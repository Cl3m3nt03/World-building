import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import fr from "./fr.json";

export const LANGUAGES = ["fr", "en"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "fr";

export type TranslationKey = keyof typeof fr;

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

function syncDocumentLanguage(language: string): void {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

/**
 * Initializes i18next with the bundled fr/en resources. Keys are flat
 * ("shell.tabs.home"), so key and namespace separators are disabled.
 * The chosen language is persisted in the app settings in 0.9.
 */
export async function initI18n(): Promise<void> {
  i18n.on("languageChanged", syncDocumentLanguage);
  await i18n.use(initReactI18next).init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: LANGUAGES,
    keySeparator: false,
    nsSeparator: false,
    interpolation: {
      // React already escapes rendered values.
      escapeValue: false,
    },
    returnNull: false,
  });
  syncDocumentLanguage(i18n.language);
}

export { i18n };
