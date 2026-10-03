import { listen } from "@tauri-apps/api/event";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
// Before any canvas opens: where Excalidraw finds its fonts.
import "./features/canvases/excalidrawAssets";
import { App } from "./app/App";
import { initTheme } from "./app/theme";
import { loadPreferences } from "./features/settings";
import { initI18n } from "./i18n";
import { commands } from "./lib/bindings";
import { BEFORE_CLOSE_EVENT, flushPendingSaves } from "./lib/pendingSaves";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

async function start(root: HTMLElement): Promise<void> {
  // Saved preferences first, so the first frame already has the right theme and language.
  const language = await loadPreferences();
  initTheme();
  await initI18n(language);
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start(rootElement);

// Closing the window saves the pending edits first (text typed less than a
// second ago): the Rust holds the close back and asks (see closing.rs), then
// closes the window anyway after a few seconds.
void listen(BEFORE_CLOSE_EVENT, async () => {
  await flushPendingSaves(3000);
  await commands.finishClose();
});
