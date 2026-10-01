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

  // Used by Radix Select.
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};

  // jsdom lays nothing out: the sidebar tree's viewport (virtualized) gets a
  // height, so its rows render as in the app.
  const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute("data-tree-viewport") ? 640 : offsetHeight?.get?.call(this);
    },
  });

  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

await initI18n();
