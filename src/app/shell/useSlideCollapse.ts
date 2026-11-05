import { motionMs } from "./navigation";

/**
 * The slide of a side column that opens or closes (motion plan, batch D): the
 * sidebar and the world rail. The new layout is applied at once, so the
 * content is laid out a single time, at the start; what moves is drawn by
 * `transform` and `opacity` only (FLIP), never by a width animated frame by
 * frame.
 */

/** The id of the animations started here. */
const SLIDE_ANIMATION = "bz-slide";

/** What the eye follows: the glass surfaces. */
const SURFACES = ".glass, .glass-veil, .glass-panel";

/** Keyframes of a slide whose surface changes width (its children are scaled back). */
const STEPS = 16;

/** A cubic Bézier easing, for the steps of a slide that scales. */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (t: number, a: number, b: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let low = 0;
    let high = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (at(mid, x1, x2) < x) low = mid;
      else high = mid;
    }
    return at((low + high) / 2, y1, y2);
  };
}

/** The `--bz-ease-in-out` token, as a CSS easing and as a function. */
function easing(): { css: string; at: (x: number) => number } {
  const css =
    getComputedStyle(document.documentElement).getPropertyValue("--bz-ease-in-out").trim() ||
    "ease-in-out";
  const values = /cubic-bezier\(([^)]+)\)/.exec(css)?.[1]?.split(",").map(Number);
  const [x1, y1, x2, y2] = values?.length === 4 ? values : [0.42, 0, 0.58, 1];
  return { css, at: bezier(x1 ?? 0.42, y1 ?? 0, x2 ?? 0.58, y2 ?? 1) };
}

/** The glass surfaces of `root` that are not inside another one. */
function surfacesOf(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(SURFACES)].filter((element) => {
    const outer = element.parentElement?.closest(SURFACES);
    return !outer || !root.contains(outer);
  });
}

/** The slide still running, stopped where it is before another one starts. */
let running: { stop: () => void } | null = null;

/** The element that leaves: kept in place, out of the layout, while it slides out. */
export interface Leaving {
  element: HTMLElement;
  /** Takes it out of the layout at its current place; returns what undoes it. */
  pin: (element: HTMLElement, from: DOMRect) => () => void;
}

export interface Slide {
  /** The element whose glass surfaces follow the new layout. */
  root: HTMLElement;
  /** Applies the new layout, at once (a collapse, a state change). */
  change: () => void;
  /** The column that leaves, if it closes. */
  leaving?: Leaving | undefined;
  /** The column that comes in, if it opens, found once the new layout is there. */
  entering?: (() => HTMLElement | null) | undefined;
  /** How far the column slides out of view, in pixels (negative: to the left). */
  distance: number;
  /**
   * Ancestors of the surfaces that would cut them during the slide (a panel
   * that scrolls), shown whole until it ends.
   */
  unclip?: string | undefined;
  /** Called once the slide is over, at once if nothing moves. */
  done?: (() => void) | undefined;
}

function play(
  element: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Animation | null {
  if (typeof element.animate !== "function") return null;
  // No `fill`: once done, nothing keeps a transform that would trap fixed elements.
  return element.animate(keyframes, { id: SLIDE_ANIMATION, ...options });
}

/**
 * Applies `change` and slides the surfaces of `root` from where they were to
 * where the new layout puts them, in `--bz-duration-base`. A surface that only
 * moves is translated; one that also changes width is scaled, its children
 * scaled back so the text keeps its new layout, unstretched. A slide still
 * running is stopped where it is, and the new one starts from there. Under
 * reduced motion (the token is 0), the new layout is applied and that is all.
 */
export function slideLayout(slide: Slide) {
  const duration = motionMs("--bz-duration-base");
  if (duration === 0 || typeof ResizeObserver === "undefined") {
    running?.stop();
    slide.change();
    slide.done?.();
    return;
  }
  // Where everything is now, mid-slide included.
  const targets = surfacesOf(slide.root);
  const first = new Map(targets.map((target) => [target, target.getBoundingClientRect()]));
  const leaving = slide.leaving?.element;
  const leavingFrom = leaving?.getBoundingClientRect();
  const leavingOpacity = leaving ? Number.parseFloat(getComputedStyle(leaving).opacity) || 0 : 1;
  const entering = slide.entering?.();
  const enteringOpacity =
    entering?.getAnimations?.().some((animation) => animation.id === SLIDE_ANIMATION) === true
      ? Number.parseFloat(getComputedStyle(entering).opacity) || 0
      : 0;
  running?.stop();
  slide.change();

  const animations: Animation[] = [];
  const undo: (() => void)[] = [];
  // What keeps the leaving column out of the layout and faded out: left as
  // it is at the end, until the column is unmounted (`done`), so it never
  // shows again for a frame.
  let leavingAnimation: Animation | null = null;
  const unpin: (() => void)[] = [];
  // Out of the layout at once, so the new layout is complete.
  if (leaving && leavingFrom && slide.leaving) {
    leaving.inert = true;
    unpin.push(slide.leaving.pin(leaving, leavingFrom), () => {
      leaving.inert = false;
    });
  }

  // The slide starts once the new layout is there, before it is painted:
  // right after React applies it (a microtask), or else when a resize
  // observer is called (before the next paint, and at least once).
  let started = false;
  const observer = new ResizeObserver(() => start(true));
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = (stopped: boolean) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    observer.disconnect();
    for (const animation of animations) animation.cancel();
    for (const restore of undo) restore();
    if (stopped) {
      leavingAnimation?.cancel();
      for (const restore of unpin) restore();
    }
    if (running === current) running = null;
    slide.done?.();
  };
  const current = { stop: () => finish(true) };
  running = current;

  function start(observed: boolean) {
    if (started || finished) return;
    const moves = targets.map((target) => {
      const from = first.get(target);
      if (!from || !target.isConnected) return null;
      const to = target.getBoundingClientRect();
      const dx = from.left - to.left;
      const scale = to.width > 0 ? from.width / to.width : 1;
      if (Math.abs(dx) < 0.5 && Math.abs(scale - 1) < 0.002) return null;
      return { target, dx, scale };
    });
    const coming = slide.entering?.() ?? null;
    // Not applied yet: wait for the observer.
    if (!observed && moves.every((move) => move === null) && (!slide.entering || !coming)) return;
    started = true;
    observer.disconnect();
    const ease = easing();
    const options = { duration, easing: ease.css };
    // The surfaces' clipping ancestors, shown whole for the slide.
    if (slide.unclip) {
      const clips = new Set<HTMLElement>();
      for (const target of targets) {
        for (let up = target.parentElement; up && up !== slide.root; up = up.parentElement) {
          if (up.matches(slide.unclip)) clips.add(up);
        }
      }
      for (const clip of clips) {
        const before = clip.style.overflow;
        clip.style.overflow = "visible";
        undo.push(() => {
          clip.style.overflow = before;
        });
      }
    }
    for (const move of moves) {
      if (!move) continue;
      const { target, dx, scale } = move;
      if (Math.abs(scale - 1) < 0.002) {
        const animation = play(
          target,
          [{ transform: `translateX(${dx}px)` }, { transform: "none" }],
          options,
        );
        if (animation) animations.push(animation);
        continue;
      }
      // Its width changes: the glass is scaled from its old box, and its
      // children scaled back, so the text sits in its new layout from the start.
      const frames: Keyframe[] = [];
      const back: Keyframe[] = [];
      for (let i = 0; i <= STEPS; i++) {
        const left = 1 - ease.at(i / STEPS);
        const s = 1 + (scale - 1) * left;
        frames.push({
          transform: `translateX(${dx * left}px) scaleX(${s})`,
          transformOrigin: "0 0",
        });
        back.push({ transform: `scaleX(${1 / s})`, transformOrigin: "0 0" });
      }
      const linear = { duration, easing: "linear" };
      const own = play(target, frames, linear);
      if (own) animations.push(own);
      const overflowX = target.style.overflowX;
      target.style.overflowX = "clip";
      undo.push(() => {
        target.style.overflowX = overflowX;
      });
      for (const child of target.children) {
        if (!(child instanceof HTMLElement)) continue;
        const animation = play(child, back, { ...linear, composite: "add" });
        if (animation) animations.push(animation);
      }
    }
    if (leaving?.isConnected && unpin.length > 0) {
      leavingAnimation = play(
        leaving,
        [
          { transform: "none", opacity: leavingOpacity },
          { transform: `translateX(${slide.distance}px)`, opacity: 0 },
        ],
        { ...options, fill: "forwards" },
      );
    }
    if (coming) {
      // Its own entry (a delayed settle) would hide it again after the slide.
      for (const animation of coming.getAnimations?.() ?? []) {
        if (animation.id !== SLIDE_ANIMATION) animation.finish();
      }
      const animation = play(
        coming,
        [
          {
            transform: `translateX(${slide.distance * (1 - enteringOpacity)}px)`,
            opacity: enteringOpacity,
          },
          { transform: "none", opacity: 1 },
        ],
        options,
      );
      if (animation) animations.push(animation);
    }
    const all = leavingAnimation ? [...animations, leavingAnimation] : animations;
    if (all.length === 0) {
      finish(false);
      return;
    }
    Promise.all(all.map((animation) => animation.finished)).then(
      () => finish(false),
      () => {},
    );
  }

  observer.observe(slide.root);
  queueMicrotask(() => start(false));
  // In case nothing ends (an element removed meanwhile): never stuck mid-way.
  timer = setTimeout(() => finish(false), duration + 300);
}
