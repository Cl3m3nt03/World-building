import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { App } from "./app/App";
import { initTheme } from "./app/theme";
import { loadPreferences } from "./features/settings";
import { initI18n } from "./i18n";

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
