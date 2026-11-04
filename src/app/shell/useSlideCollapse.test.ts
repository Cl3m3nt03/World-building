// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { slideLayout } from "./useSlideCollapse";

const root = document.documentElement.style;

/** A box at `left`, `width` wide, until `move` changes it. */
function surface(left: number, width: number) {
  const element = document.createElement("article");
  element.className = "glass";
  element.append(document.createElement("p"));
  const box = { left, width };
  element.getBoundingClientRect = () =>
    ({ left: box.left, width: box.width, top: 0, height: 100 }) as DOMRect;
  return { element, move: (to: { left: number; width: number }) => Object.assign(box, to) };
}

describe("slideLayout", () => {
  const animate = vi.fn(() => ({ finished: new Promise(() => {}), cancel: vi.fn() }));
  let observed: (() => void) | null = null;
  beforeEach(() => {
    animate.mockClear();
    Element.prototype.animate = animate as unknown as Element["animate"];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          observed = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    root.setProperty("--bz-duration-base", "200ms");
    root.setProperty("--bz-ease-in-out", "cubic-bezier(0.6, 0, 0.3, 1)");
  });
  afterEach(() => {
    root.removeProperty("--bz-duration-base");
    root.removeProperty("--bz-ease-in-out");
    vi.unstubAllGlobals();
    observed = null;
    document.body.replaceChildren();
  });

  it("applies the new layout and animates nothing under reduced motion", () => {
    root.setProperty("--bz-duration-base", "0ms");
    const page = document.body.appendChild(document.createElement("main"));
    const { element, move } = surface(300, 800);
    page.append(element);
    const change = vi.fn(() => move({ left: 0, width: 800 }));
    const done = vi.fn();
    slideLayout({ root: page, change, distance: -280, done });
    expect(change).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledTimes(1);
    expect(observed).toBeNull();
    expect(animate).not.toHaveBeenCalled();
  });

  it("slides a surface that only moves from its old place, by transform", () => {
    const page = document.body.appendChild(document.createElement("main"));
    const { element, move } = surface(300, 800);
    page.append(element);
    slideLayout({ root: page, change: () => move({ left: 160, width: 800 }), distance: -280 });
    // Nothing runs before the new layout is there.
    expect(animate).not.toHaveBeenCalled();
    observed?.();
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.contexts[0]).toBe(element);
    expect(animate.mock.calls[0]).toEqual([
      [{ transform: "translateX(140px)" }, { transform: "none" }],
      expect.objectContaining({ duration: 200, easing: "cubic-bezier(0.6, 0, 0.3, 1)" }),
    ]);
  });

  it("scales a surface that changes width from its old box, its content scaled back", () => {
    const page = document.body.appendChild(document.createElement("main"));
    const { element, move } = surface(300, 700);
    page.append(element);
    slideLayout({ root: page, change: () => move({ left: 20, width: 980 }), distance: -280 });
    observed?.();
    expect(animate).toHaveBeenCalledTimes(2);
    const frames = animate.mock.calls[0]?.[0] as unknown as Keyframe[];
    const back = animate.mock.calls[1]?.[0] as unknown as Keyframe[];
    // From the old box (its right edge in place) to the new one.
    expect(frames[0]?.transform).toBe(`translateX(280px) scaleX(${700 / 980})`);
    expect(frames.at(-1)?.transform).toBe("translateX(0px) scaleX(1)");
    // The text keeps its new width all along.
    expect(Number(/scaleX\((.+)\)/.exec(String(back[0]?.transform))?.[1])).toBeCloseTo(980 / 700);
    expect(back.at(-1)?.transform).toBe("scaleX(1)");
    expect(animate.mock.contexts[1]).toBe(element.firstElementChild);
  });
});
