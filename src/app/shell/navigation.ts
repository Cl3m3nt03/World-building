import { type RefObject, useLayoutEffect, useRef } from "react";

/** A motion token's duration, in milliseconds (0 under reduced motion). */
export function motionMs(name: string): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (value.endsWith("ms")) return Number.parseFloat(value);
  if (value.endsWith("s")) return Number.parseFloat(value) * 1000;
  return 0;
}

/** What a page transition animates. */
export type PageTarget =
  /** The whole page: a tab, which brings its own layout and glass. */
  | "page"
  /**
   * The content of the page's glass panel, never the panel itself: every
   * document page is one `<article>` panel, which stays while its children change.
   */
  | "panel";

/** The id of the animations started here, to find one still running. */
const PAGE_ANIMATION = "bz-page";

function targetsOf(element: HTMLElement, target: PageTarget): Element[] {
  if (target === "page") return [element];
  return [...(element.querySelector("article")?.children ?? [])];
}

/**
 * Plays the entry of a page's new content: opacity 0 to 1 over
 * `--bz-duration-page`, and, for a `direction` of 1 or -1, a shift of
 * `--bz-shift-md` from that side (1: from the right, as when going to a
 * later tab). A transition still running is cut and the
 * new one starts from its current opacity. Nothing runs under reduced motion
 * (the tokens are 0). Exported for the tests.
 */
export function playPageEntry(elements: readonly Element[], direction: number) {
  const duration = motionMs("--bz-duration-page");
  if (duration === 0) return;
  const root = getComputedStyle(document.documentElement);
  const easing = root.getPropertyValue("--bz-ease-out").trim() || "ease-out";
  const shift =
    (Number.parseFloat(root.getPropertyValue("--bz-shift-md")) || 0) * Math.sign(direction);
  for (const element of elements) {
    if (typeof element.animate !== "function") continue;
    let opacity = 0;
    const running = element.getAnimations?.().find((animation) => animation.id === PAGE_ANIMATION);
    if (running) {
      opacity = Number.parseFloat(getComputedStyle(element).opacity) || 0;
      running.cancel();
    }
    const from: Keyframe = { opacity };
    const to: Keyframe = { opacity: 1 };
    if (shift !== 0) {
      from.transform = `translateX(${shift}px)`;
      to.transform = "translateX(0)";
    }
    // No `fill`: once done, the page keeps no transform that would trap its
    // fixed elements.
    element.animate([from, to], { id: PAGE_ANIMATION, duration, easing });
  }
}

/**
 * The page's new content enters when `key` changes (V2, ADR 0012; motion
 * plan, batch B): another tab, another document. Run by the Web Animations
 * API before the browser paints the new content, so it never shows at full
 * opacity first; the page is not remounted. The router shows a page once its
 * data is there (`ready` in `router.tsx`), so this plays on the finished
 * content, never on an empty panel. The first render plays nothing (the
 * world's entry has its own sequence), nor does the same key again.
 */
export function usePageTransition(
  ref: RefObject<HTMLElement | null>,
  key: string | null | undefined,
  {
    target,
    direction,
  }: {
    target: PageTarget;
    /** The side the content comes from, from one key to the next: 1, -1 or 0. */
    direction?: ((from: string | null, to: string | null) => number) | undefined;
  },
) {
  const previous = useRef<string | null | undefined>(undefined);
  useLayoutEffect(() => {
    if (key === undefined) return;
    const before = previous.current;
    previous.current = key;
    if (before === undefined || before === key) return;
    const element = ref.current;
    if (element) playPageEntry(targetsOf(element, target), direction?.(before, key) ?? 0);
  }, [ref, key, target, direction]);
}
