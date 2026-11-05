import { describe, expect, it } from "vitest";
import { contrast, luminance, type Rgb, veilAlpha } from "./backdropVeil";

const INK: Rgb = [14, 12, 8];
const DARK_TEXTS: Rgb[] = [
  [0xc0, 0xb5, 0x9e],
  [0xee, 0xe4, 0xcf],
];
const PAPER: Rgb = [242, 233, 212];
const LIGHT_TEXTS: Rgb[] = [[0x2b, 0x22, 0x19]];

function veiled(alpha: number, veil: Rgb, pixel: Rgb): Rgb {
  return veil.map((v, i) => alpha * v + (1 - alpha) * pixel[i]) as unknown as Rgb;
}

describe("veilAlpha", () => {
  it("keeps the theme's veil over a dark image", () => {
    expect(veilAlpha([20, 20, 30, 40, 30, 20], INK, DARK_TEXTS, 0.55)).toBe(0.55);
  });

  it("darkens the veil over a white image until bare text is AA", () => {
    const alpha = veilAlpha([255, 255, 255], INK, DARK_TEXTS, 0.55);
    expect(alpha).toBeGreaterThan(0.7);
    expect(alpha).toBeLessThan(0.9);
    const background = luminance(veiled(alpha, INK, [255, 255, 255]));
    expect(contrast(luminance(DARK_TEXTS[0]), background)).toBeGreaterThanOrEqual(4.5);
  });

  it("follows the image's brightest sample", () => {
    const pale = veilAlpha([60, 50, 40, 230, 210, 220], INK, DARK_TEXTS, 0.55);
    const white = veilAlpha([255, 255, 255], INK, DARK_TEXTS, 0.55);
    expect(pale).toBeGreaterThan(0.55);
    expect(pale).toBeLessThanOrEqual(white);
  });

  it("assumes the worst image when it cannot be measured", () => {
    expect(veilAlpha(null, INK, DARK_TEXTS, 0.55)).toBe(
      veilAlpha([255, 255, 255], INK, DARK_TEXTS, 0.55),
    );
  });

  it("works the other way in the light theme", () => {
    expect(veilAlpha([0, 0, 0], PAPER, LIGHT_TEXTS, 0.82)).toBe(0.82);
    const alpha = veilAlpha([0, 0, 0], PAPER, [[0x6e, 0x60, 0x4c]], 0.5);
    expect(alpha).toBeGreaterThan(0.5);
  });
});
