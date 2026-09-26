import { type OpenDialogOptions, type OpenDialogReturn, open } from "@tauri-apps/plugin-dialog";

type DialogAnswer = string | string[] | null;

declare global {
  interface Window {
    /** E2E builds only: answers given to the next file dialogs, in order. */
    __bzE2eDialogAnswers?: DialogAnswer[];
  }
}

/**
 * Native file or folder dialog (tauri-plugin-dialog). WebDriver cannot drive
 * native dialogs, so builds made for the end-to-end tests (`VITE_E2E=1`, see
 * e2e/wdio.conf.ts) first take their answers from a queue the tests fill.
 * Vite replaces the flag at build time: release builds do not contain it.
 */
export async function openDialog<T extends OpenDialogOptions>(
  options: T,
): Promise<OpenDialogReturn<T>> {
  if (import.meta.env.VITE_E2E === "1") {
    const answer = window.__bzE2eDialogAnswers?.shift();
    if (answer !== undefined) return answer as OpenDialogReturn<T>;
  }
  return open(options);
}
