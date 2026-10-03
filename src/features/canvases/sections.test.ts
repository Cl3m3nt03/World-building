import { describe, expect, it } from "vitest";
import { frameAround, insertionIndex, sectionName, unnamedFrames } from "./sections";

const frame = (id: string, x: number, y: number, patch = {}) => ({
  id,
  type: "frame",
  x,
  y,
  width: 400,
  height: 300,
  ...patch,
});

describe("frameAround", () => {
  it("finds the topmost section holding the whole box", () => {
    const elements = [
      frame("outer", 0, 0, { width: 1000, height: 1000 }),
      frame("inner", 100, 100),
    ];
    expect(frameAround(elements, { x: 150, y: 150, width: 100, height: 80 })).toBe("inner");
    expect(frameAround(elements, { x: 600, y: 600, width: 100, height: 80 })).toBe("outer");
  });

  it("leaves out a box across the edge, removed sections and other elements", () => {
    const elements = [
      frame("gone", 0, 0, { isDeleted: true }),
      { ...frame("shape", 0, 0), type: "rectangle" },
      frame("small", 0, 0, { width: 100, height: 100 }),
    ];
    expect(frameAround(elements, { x: 50, y: 50, width: 100, height: 100 })).toBeNull();
  });
});

it("puts a new element right before its section, at the end otherwise", () => {
  const elements = [{ id: "a" }, { id: "f" }, { id: "b" }];
  expect(insertionIndex(elements, "f")).toBe(1);
  expect(insertionIndex(elements, null)).toBe(3);
  expect(insertionIndex(elements, "gone")).toBe(3);
});

it("lists the sections without a name", () => {
  expect(
    unnamedFrames([
      frame("a", 0, 0, { name: null }),
      frame("b", 0, 0, { name: "Nord" }),
      frame("c", 0, 0),
    ]),
  ).toEqual(["a", "c"]);
});

it("numbers a new section after the named ones, skipping numbers in use", () => {
  expect(sectionName("Section", [null])).toBe("Section 1");
  expect(sectionName("Section", ["Nord", null])).toBe("Section 2");
  expect(sectionName("Section", ["Section 2", null])).toBe("Section 3");
});
