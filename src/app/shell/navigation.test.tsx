// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { motionMs, type PageTarget, usePageTransition } from "./navigation";

const TOKEN = "--bz-duration-test";

describe("motionMs", () => {
  afterEach(() => document.documentElement.style.removeProperty(TOKEN));

  it("reads a duration token in milliseconds or seconds", () => {
    document.documentElement.style.setProperty(TOKEN, "160ms");
    expect(motionMs(TOKEN)).toBe(160);
    document.documentElement.style.setProperty(TOKEN, "0.2s");
    expect(motionMs(TOKEN)).toBe(200);
  });

  it("is 0 under reduced motion, where the tokens are 0, and for an unknown token", () => {
    document.documentElement.style.setProperty(TOKEN, "0ms");
    expect(motionMs(TOKEN)).toBe(0);
    expect(motionMs("--bz-duration-none")).toBe(0);
  });
});

describe("usePageTransition", () => {
  const animate = vi.fn();
  beforeEach(() => {
    animate.mockReset();
    Element.prototype.animate = animate as unknown as Element["animate"];
    Element.prototype.getAnimations = () => [];
    const root = document.documentElement.style;
    root.setProperty("--bz-duration-page", "160ms");
    root.setProperty("--bz-shift-md", "8px");
    root.setProperty("--bz-ease-out", "ease-out");
  });
  afterEach(() => {
    cleanup();
    for (const token of ["--bz-duration-page", "--bz-shift-md", "--bz-ease-out"]) {
      document.documentElement.style.removeProperty(token);
    }
  });

  function Page({
    id,
    target,
    direction,
  }: {
    id: string;
    target: PageTarget;
    direction?: (from: string | null, to: string | null) => number;
  }) {
    const ref = useRef<HTMLDivElement>(null);
    usePageTransition(ref, id, { target, direction });
    return (
      <div ref={ref} data-testid="page">
        <article data-testid="panel">
          <header data-testid="content">{id}</header>
        </article>
      </div>
    );
  }

  it("plays nothing on the first render, nor for the same key again", () => {
    const { rerender } = render(<Page id="a" target="page" />);
    rerender(<Page id="a" target="page" />);
    expect(animate).not.toHaveBeenCalled();
  });

  it("animates the panel's content, never the glass panel itself", () => {
    const { rerender } = render(<Page id="a" target="panel" />);
    rerender(<Page id="b" target="panel" />);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.contexts[0]).toBe(screen.getByTestId("content"));
    expect(animate.mock.calls[0]?.[0]).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(animate.mock.calls[0]?.[1]).toMatchObject({ duration: 160, easing: "ease-out" });
  });

  it("shifts a tab's page from the side of its direction", () => {
    const { rerender } = render(<Page id="home" target="page" direction={() => -1} />);
    rerender(<Page id="world" target="page" direction={() => -1} />);
    expect(animate.mock.contexts[0]).toBe(screen.getByTestId("page"));
    expect(animate.mock.calls[0]?.[0]).toEqual([
      { opacity: 0, transform: "translateX(-8px)" },
      { opacity: 1, transform: "translateX(0)" },
    ]);
  });

  it("starts an interrupted transition from its current opacity", () => {
    const cancel = vi.fn();
    const { rerender } = render(<Page id="a" target="page" />);
    const page = screen.getByTestId("page");
    page.style.opacity = "0.6";
    page.getAnimations = () => [{ id: "bz-page", cancel } as unknown as Animation];
    rerender(<Page id="b" target="page" />);
    expect(cancel).toHaveBeenCalled();
    expect(animate.mock.calls[0]?.[0]).toEqual([{ opacity: 0.6 }, { opacity: 1 }]);
  });

  it("plays nothing under reduced motion, where the tokens are 0", () => {
    document.documentElement.style.setProperty("--bz-duration-page", "0ms");
    document.documentElement.style.setProperty("--bz-shift-md", "0px");
    const { rerender } = render(<Page id="a" target="page" direction={() => 1} />);
    rerender(<Page id="b" target="page" direction={() => 1} />);
    expect(animate).not.toHaveBeenCalled();
  });
});
