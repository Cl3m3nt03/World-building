import { describe, expect, it } from "vitest";
import { optionsFor, type Style, type StyledElement, shownValue, stylePatches } from "./tools";

const element = (patch: Partial<StyledElement> & Pick<StyledElement, "id" | "type">) =>
  ({ width: 100, height: 40, ...patch }) as StyledElement;

const current: Style = {
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  fillStyle: "hachure",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: 1,
  fontSize: 20,
};

describe("optionsFor", () => {
  it("offers the active tool's options", () => {
    expect(optionsFor("freedraw", [])).toEqual(["strokeColor", "strokeWidth"]);
    expect(optionsFor("rectangle", [])).toContain("backgroundColor");
    expect(optionsFor("hand", [])).toEqual([]);
  });

  it("offers nothing with the selection tool and nothing selected", () => {
    expect(optionsFor("selection", [])).toEqual([]);
  });

  it("offers what every selected element shares", () => {
    const options = optionsFor("selection", [
      element({ id: "a", type: "rectangle" }),
      element({ id: "b", type: "arrow" }),
    ]);
    expect(options).toEqual(["strokeColor", "strokeWidth", "strokeStyle", "roughness"]);
    expect(
      optionsFor("selection", [
        element({ id: "a", type: "text" }),
        element({ id: "b", type: "freedraw" }),
      ]),
    ).toEqual(["strokeColor"]);
  });
});

describe("shownValue", () => {
  it("shows the next element's style when nothing is selected", () => {
    expect(shownValue("strokeWidth", [], current)).toBe(2);
  });

  it("shows the selection's style when it agrees, none otherwise", () => {
    const red = element({ id: "a", type: "rectangle", strokeColor: "#e03131" });
    const blue = element({ id: "b", type: "rectangle", strokeColor: "#1971c2" });
    expect(shownValue("strokeColor", [red], current)).toBe("#e03131");
    expect(shownValue("strokeColor", [red, blue], current)).toBeUndefined();
  });
});

describe("stylePatches", () => {
  it("styles only the elements the style means something for", () => {
    const patches = stylePatches(
      [element({ id: "a", type: "rectangle" }), element({ id: "b", type: "text" })],
      "backgroundColor",
      "#ffc9c9",
    );
    expect([...patches.keys()]).toEqual(["a"]);
    expect(patches.get("a")).toEqual({ backgroundColor: "#ffc9c9" });
  });

  it("skips removed elements", () => {
    expect(
      stylePatches([element({ id: "a", type: "line", isDeleted: true })], "strokeWidth", 4).size,
    ).toBe(0);
  });

  it("grows a text's box with its font size", () => {
    const patches = stylePatches(
      [element({ id: "t", type: "text", fontSize: 20, width: 100, height: 25 })],
      "fontSize",
      40,
    );
    expect(patches.get("t")).toEqual({ fontSize: 40, width: 200, height: 50 });
  });
});
