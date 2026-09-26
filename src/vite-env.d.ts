/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" in builds made for the end-to-end tests (see src/lib/dialogs.ts). */
  readonly VITE_E2E?: string;
}
