/**
 * The living atlas (ADR 0012): an engraved map drawn by the app behind the
 * interface — contour lines around a few summits, a graticule and a compass
 * rose. Pure geometry, seeded by the world so each world has its own relief
 * and the same one every time.
 */

/** The SVG's own space; it covers the window with `slice`. */
export const ATLAS_WIDTH = 1600;
export const ATLAS_HEIGHT = 1000;

export interface AtlasRelief {
  /** One closed path per contour line, outer rings first. */
  contours: string[];
  /** Index lines (every fourth ring), drawn a little stronger. */
  indexContours: string[];
}

/** A 32-bit hash of the seed (FNV-1a). */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A small deterministic random generator (mulberry32). */
export function random(seed: string): () => number {
  let state = hash(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value: number) => Math.round(value * 10) / 10;

/** A smooth closed path through the points (Catmull-Rom as cubic Béziers). */
export function closedCurve(points: [number, number][]): string {
  const n = points.length;
  const at = (i: number) => points[(i + n) % n] as [number, number];
  let d = `M${round(at(0)[0])} ${round(at(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    const c1 = [x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6];
    const c2 = [x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6];
    d += `C${round(c1[0] as number)} ${round(c1[1] as number)} ${round(c2[0] as number)} ${round(c2[1] as number)} ${round(x2)} ${round(y2)}`;
  }
  return `${d}Z`;
}

const STEPS = 48;

/**
 * The relief of a world: three to four summits, each ringed by contour lines
 * whose wobble grows outward, like a hand-engraved survey.
 */
export function atlasRelief(seed: string): AtlasRelief {
  const next = random(seed);
  const contours: string[] = [];
  const indexContours: string[] = [];
  const summits = 3 + Math.floor(next() * 2);
  for (let s = 0; s < summits; s++) {
    // Spread the summits over the width, away from the centre of the content.
    const cx = ATLAS_WIDTH * ((s + 0.25 + next() * 0.5) / summits);
    const cy = ATLAS_HEIGHT * (0.18 + next() * 0.64);
    const rings = 7 + Math.floor(next() * 6);
    const spacing = 22 + next() * 16;
    // The shape of the hill: a few harmonics with random phases.
    const harmonics = [2, 3, 5].map((k) => ({
      k,
      amplitude: (0.05 + next() * 0.1) / (k / 2),
      phase: next() * Math.PI * 2,
    }));
    const stretch = 0.7 + next() * 0.6;
    for (let r = 1; r <= rings; r++) {
      const base = r * spacing;
      const wobble = 1 + r / rings;
      const points: [number, number][] = [];
      for (let i = 0; i < STEPS; i++) {
        const angle = (i / STEPS) * Math.PI * 2;
        let factor = 1;
        for (const h of harmonics) {
          factor += h.amplitude * wobble * Math.sin(h.k * angle + h.phase + r * 0.15);
        }
        const radius = base * factor;
        points.push([cx + Math.cos(angle) * radius * stretch, cy + Math.sin(angle) * radius]);
      }
      const path = closedCurve(points);
      (r % 4 === 0 ? indexContours : contours).push(path);
    }
  }
  return { contours, indexContours };
}
