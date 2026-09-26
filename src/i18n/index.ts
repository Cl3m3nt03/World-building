import fr from "./fr.json";

export type TranslationKey = keyof typeof fr;

/**
 * Temporary lookup, French only. Issue 0.6 replaces it with react-i18next on
 * the same fr.json / en.json files, so components already go through keys.
 */
export function t(key: TranslationKey): string {
  return fr[key];
}
