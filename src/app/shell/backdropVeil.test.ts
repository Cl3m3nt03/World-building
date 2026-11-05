import { describe, expect, it } from "vitest";
import {
  contrast,
  luminance,
  parseColor,
  type Rgb,
  type VeilLayers,
  veilAlpha,
} from "./backdropVeil";

const INK: Rgb = [14, 12, 8];
const ON_BACKDROP: Rgb = [0xc0, 0xb5, 0x9e];
const DARK_TEXTS: Rgb[] = [ON_BACKDROP, [0xee, 0xe4, 0xcf]];
const PAPER: Rgb = [242, 233, 212];
const LIGHT_TEXTS: Rgb[] = [[0x2b, 0x22, 0x19]];

const dark: VeilLayers = { veil: INK, floor: 0.55, texts: DARK_TEXTS };
const light: VeilLayers = { veil: PAPER, floor: 0.82, texts: LIGHT_TEXTS };

function veiled(alpha: number, veil: Rgb, pixel: Rgb): Rgb {
  return veil.map((v, i) => alpha * v + (1 - alpha) * (pixel[i] ?? 0)) as unknown as Rgb;
}

describe("veilAlpha", () => {
  it("keeps the theme's veil over a dark image", () => {
    expect(veilAlpha([20, 20, 30, 40, 30, 20], dark)).toBe(0.55);
  });

  it("darkens the veil over a white image until bare text is AA", () => {
    const alpha = veilAlpha([255, 255, 255], dark);
    expect(alpha).toBeGreaterThan(0.7);
    expect(alpha).toBeLessThan(0.9);
    const background = luminance(veiled(alpha, INK, [255, 255, 255]));
    expect(contrast(luminance(ON_BACKDROP), background)).toBeGreaterThanOrEqual(4.5);
  });

  it("follows the image's brightest sample", () => {
    const pale = veilAlpha([60, 50, 40, 230, 210, 220], dark);
    const white = veilAlpha([255, 255, 255], dark);
    expect(pale).toBeGreaterThan(0.55);
    expect(pale).toBeLessThanOrEqual(white);
  });

  it("assumes the worst image when it cannot be measured", () => {
    expect(veilAlpha(null, dark)).toBe(veilAlpha([255, 255, 255], dark));
  });

  it("counts the atlas's ink as background", () => {
    const inked = { ...dark, ink: { color: [212, 173, 90] as Rgb, alpha: 0.13 } };
    expect(veilAlpha([255, 255, 255], inked)).toBeGreaterThan(veilAlpha([255, 255, 255], dark));
  });

  it("works the other way in the light theme", () => {
    expect(veilAlpha([0, 0, 0], light)).toBe(0.82);
    const alpha = veilAlpha([0, 0, 0], { veil: PAPER, floor: 0.5, texts: [[0x6e, 0x60, 0x4c]] });
    expect(alpha).toBeGreaterThan(0.5);
  });
});

describe("parseColor", () => {
  it("reads the syntaxes of the computed tokens", () => {
    expect(parseColor("#c0b59e")).toEqual({ rgb: [192, 181, 158], alpha: 1 });
    expect(parseColor(" #d4ad5a38")?.alpha).toBeCloseTo(0.22, 2);
    expect(parseColor("#fff")).toEqual({ rgb: [255, 255, 255], alpha: 1 });
    expect(parseColor("14 12 8")).toEqual({ rgb: [14, 12, 8], alpha: 1 });
    expect(parseColor("rgb(212 173 90 / .22)")).toEqual({ rgb: [212, 173, 90], alpha: 0.22 });
    expect(parseColor("#12345")).toBeNull();
    expect(parseColor("")).toBeNull();
  });
});
