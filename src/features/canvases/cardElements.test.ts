import { describe, expect, it } from "vitest";
import { CARD_HEIGHT, CARD_WIDTH, cardAt, cardIdOf, cardLink, dropOrigin } from "./cardElements";

const card = (id: string, x: number, y: number, patch = {}) => ({
  type: "embeddable",
  link: cardLink(id),
  x,
  y,
  width: 200,
  height: 160,
  ...patch,
});

describe("card links", () => {
  it("round-trips a card id", () => {
    expect(cardIdOf(cardLink("abc-123"))).toBe("abc-123");
  });

  it("ignores any other link", () => {
    expect(cardIdOf("https://www.youtube.com/watch?v=x")).toBeNull();
    expect(cardIdOf("https://builderz.invalid/card/")).toBeNull();
    expect(cardIdOf("https://builderz.invalid/card/a/b")).toBeNull();
    expect(cardIdOf(null)).toBeNull();
  });
});

describe("cardAt", () => {
  it("finds the topmost card under the point", () => {
    const elements = [card("below", 0, 0), card("above", 100, 100)];
    expect(cardAt(elements, 150, 150)).toBe("above");
    expect(cardAt(elements, 50, 50)).toBe("below");
    expect(cardAt(elements, 500, 500)).toBeNull();
  });

  it("skips removed cards and other elements", () => {
    const elements = [
      card("kept", 0, 0),
      card("gone", 0, 0, { isDeleted: true }),
      { type: "rectangle", x: 0, y: 0, width: 300, height: 300 },
    ];
    expect(cardAt(elements, 10, 10)).toBe("kept");
  });

  it("hits a rotated card in its own frame", () => {
    // A quarter turn: 200 × 160 becomes 160 tall × 200 wide around its centre (100, 80).
    const turned = [card("turned", 0, 0, { angle: Math.PI / 2 })];
    expect(cardAt(turned, 100, 170)).toBe("turned");
    expect(cardAt(turned, 5, 80)).toBeNull();
  });
});

it("centres a dropped card on the point", () => {
  expect(dropOrigin(500, 300)).toEqual({ x: 500 - CARD_WIDTH / 2, y: 300 - CARD_HEIGHT / 2 });
});
