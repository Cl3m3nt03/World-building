import { type RefObject, useEffect } from "react";

/** A motion token's duration, in milliseconds (0 under reduced motion). */
function tokenDuration(name: string): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (value.endsWith("ms")) return Number.parseFloat(value);
  if (value.endsWith("s")) return Number.parseFloat(value) * 1000;
  return 0;
}

/**
 * The page fades in when `key` changes (V2, ADR 0012): another tab, another
 * document. Opacity only, run by the Web Animations API, so the page is not
 * remounted and keeps no transform that would trap its fixed elements. The
 * first render does not fade (the world's entry has its own sequence).
 */
export function usePageFade(ref: RefObject<HTMLElement | null>, key: string | null | undefined) {
  useEffect(() => {
    if (key === undefined) return;
    const element = ref.current;
    const duration = tokenDuration("--bz-duration-base");
    if (!element || duration === 0 || typeof element.animate !== "function") return;
    if (element.dataset.pageKey === undefined) {
      element.dataset.pageKey = key ?? "";
      return;
    }
    if (element.dataset.pageKey === (key ?? "")) return;
    element.dataset.pageKey = key ?? "";
    const easing = getComputedStyle(document.documentElement).getPropertyValue("--bz-ease-out");
    element.animate([{ opacity: 0.35 }, { opacity: 1 }], {
      duration,
      easing: easing || "ease-out",
    });
  }, [ref, key]);
}
