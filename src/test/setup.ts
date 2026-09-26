import { initI18n } from "@/i18n";

// Browser APIs that jsdom does not implement, used by the theme sync and Radix.
if (typeof window !== "undefined") {
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;

  // Called by the router on navigation; jsdom only logs "not implemented".
  window.scrollTo = () => {};

  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

await initI18n();
