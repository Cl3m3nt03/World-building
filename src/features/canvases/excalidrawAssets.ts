/**
 * Where Excalidraw finds its fonts: served by the app (vite.config.ts),
 * never by a CDN (the app works offline; its CSP allows its own fonts only).
 * Set when the app starts (main.tsx): Excalidraw reads it as its module
 * loads, and its lazy chunk runs before any code of the canvas's own chunk.
 */
(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = "/excalidraw/";
