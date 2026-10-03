/// <reference types="vitest/config" />
import { cpSync, createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const host = process.env.TAURI_DEV_HOST;

/**
 * Excalidraw's fonts (the canvas, M7), served by the app itself: the app
 * works offline and its CSP allows fonts from itself only. Excalidraw finds
 * them under `window.EXCALIDRAW_ASSET_PATH` (set to `/excalidraw/` by the
 * canvas); they are served from node_modules in dev and copied at build.
 */
function excalidrawFonts(): Plugin {
  const source = path.resolve(
    import.meta.dirname,
    "node_modules/@excalidraw/excalidraw/dist/prod/fonts",
  );
  const prefix = "/excalidraw/fonts/";
  let outDir = "dist";
  return {
    name: "builderz-excalidraw-fonts",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = request.url?.split("?")[0] ?? "";
        if (!url.startsWith(prefix)) return next();
        const file = path.join(source, decodeURIComponent(url.slice(prefix.length)));
        if (!file.startsWith(source) || !existsSync(file) || !statSync(file).isFile()) {
          return next();
        }
        response.setHeader("Content-Type", "font/woff2");
        createReadStream(file).pipe(response);
      });
    },
    writeBundle() {
      cpSync(source, path.join(outDir, "excalidraw", "fonts"), { recursive: true });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), excalidrawFonts()],
  test: {
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
