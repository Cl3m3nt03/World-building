import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { App } from "./app/App";
import { initTheme } from "./app/theme";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

initTheme();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
