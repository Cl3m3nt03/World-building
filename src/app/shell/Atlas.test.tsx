// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useUiStore } from "@/app/stores/ui";
import { Atlas } from "./Atlas";

function relief() {
  return screen.getByTestId("atlas").querySelectorAll(":scope > g")[1] as SVGGElement;
}

function point(x: number, y: number) {
  act(() => {
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y }));
  });
}

describe("Atlas", () => {
  afterEach(() => {
    cleanup();
    useUiStore.setState({ transparency: "on" });
  });

  it("leans away from the pointer", async () => {
    render(<Atlas seed="world" />);
    point(0, 0);
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    expect(relief().style.transform).toBe("translate(14px, 14px)");
  });

  it("draws its contour lines when a world opens", () => {
    render(<Atlas seed="world" draw />);
    const lines = screen.getByTestId("atlas").querySelectorAll("path[pathLength]");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line.classList.contains("atlas-draw")).toBe(true);
  });

  it("is simply there on the world list", () => {
    render(<Atlas seed="builderz" />);
    expect(screen.getByTestId("atlas").querySelector(".atlas-draw")).toBeNull();
  });

  it("stays still when transparency is off", async () => {
    useUiStore.setState({ transparency: "off" });
    render(<Atlas seed="world" />);
    point(0, 0);
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    expect(relief().style.transform).toBe("translate(0px, 0px)");
  });
});
