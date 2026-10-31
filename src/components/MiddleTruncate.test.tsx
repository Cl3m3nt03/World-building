// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MiddleTruncate } from "./MiddleTruncate";

describe("MiddleTruncate", () => {
  it("keeps the whole text, with its end apart from the part that can shrink", () => {
    const path = "C:/Users/someone/Documents/BuilderZ/worlds/Les Marches";
    render(<MiddleTruncate text={path} />);
    const whole = screen.getByTitle(path);
    expect(whole.textContent).toBe(path);
    expect(whole.lastElementChild?.textContent).toBe(path.slice(-24));
  });

  it("does not cut a short text", () => {
    render(<MiddleTruncate text="C:/w" />);
    expect(screen.getByTitle("C:/w").lastElementChild?.textContent).toBe("C:/w");
  });
});
