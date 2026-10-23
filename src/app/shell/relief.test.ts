import { describe, expect, it } from "vitest";
import { atlasRelief, closedCurve, random } from "./relief";

describe("atlas", () => {
  it("draws the same relief for the same world", () => {
    expect(atlasRelief("world-a")).toEqual(atlasRelief("world-a"));
  });

  it("gives each world its own relief", () => {
    expect(atlasRelief("world-a").contours[0]).not.toEqual(atlasRelief("world-b").contours[0]);
  });

  it("rings three or four summits with closed contour lines", () => {
    const relief = atlasRelief("world-a");
    const all = [...relief.contours, ...relief.indexContours];
    expect(all.length).toBeGreaterThanOrEqual(3 * 7);
    expect(relief.indexContours.length).toBeGreaterThan(0);
    for (const d of all) expect(d).toMatch(/^M[\d.-]+ [\d.-]+(C[\d. -]+)+Z$/);
  });

  it("draws a curve through every point", () => {
    const d = closedCurve([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    expect(d.startsWith("M0 0")).toBe(true);
    expect(d.match(/C/g)).toHaveLength(3);
    expect(d).toContain(" 10 10C");
  });

  it("keeps its random numbers between 0 and 1", () => {
    const next = random("seed");
    for (let i = 0; i < 100; i++) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
