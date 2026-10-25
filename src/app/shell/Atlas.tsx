import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { useUiStore } from "@/app/stores/ui";
import { ATLAS_HEIGHT, ATLAS_WIDTH, atlasRelief } from "./relief";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const REDUCED_TRANSPARENCY = "(prefers-reduced-transparency: reduce)";
/** How far each layer follows the pointer, in pixels (the relief more than the rose). */
const DEPTH = { relief: 14, rose: 6 };
/** The layers ease after the pointer rather than stick to it. */
const DRIFT = "transition-transform duration-(--bz-duration-slow) ease-atlas";

/** The compass rose: eight long and short points, half inked, in two rings. */
function CompassRose({ x, y, size }: { x: number; y: number; size: number }) {
  // By rank, the long points drawn last, over the short ones.
  const points: ReactNode[][] = [[], [], []];
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const length = i % 4 === 0 ? size : i % 2 === 0 ? size * 0.62 : size * 0.38;
    // Each point is a diamond: its shoulders sit between it and its neighbours.
    const rank = i % 4 === 0 ? 0 : i % 2 === 0 ? 1 : 2;
    const half = [Math.PI / 4, Math.PI / 8, Math.PI / 16][rank] as number;
    const width = size * ([0.16, 0.11, 0.07][rank] as number);
    const tip = [Math.cos(angle) * length, Math.sin(angle) * length];
    const left = [Math.cos(angle - half) * width, Math.sin(angle - half) * width];
    const right = [Math.cos(angle + half) * width, Math.sin(angle + half) * width];
    points[rank]?.push(
      <g key={i}>
        <path
          d={`M0 0L${left[0]} ${left[1]}L${tip[0]} ${tip[1]}Z`}
          fill="var(--bz-atlas-ink-strong)"
        />
        <path d={`M0 0L${right[0]} ${right[1]}L${tip[0]} ${tip[1]}Z`} fill="none" />
      </g>,
    );
  }
  const ticks = [];
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    const inner = size * (i % 9 === 0 ? 0.74 : 0.79);
    ticks.push(
      <line
        key={i}
        x1={Math.cos(angle) * inner}
        y1={Math.sin(angle) * inner}
        x2={Math.cos(angle) * size * 0.82}
        y2={Math.sin(angle) * size * 0.82}
      />,
    );
  }
  return (
    <g transform={`translate(${x} ${y})`} stroke="var(--bz-atlas-ink-strong)" strokeWidth={0.8}>
      <circle r={size * 0.82} fill="none" />
      <circle r={size * 0.7} fill="none" strokeDasharray="1 3" />
      {ticks}
      {points[2]}
      {points[1]}
      {points[0]}
      <circle r={size * 0.05} fill="var(--bz-atlas-ink-strong)" stroke="none" />
    </g>
  );
}

/**
 * The living atlas (ADR 0012): the engraved map behind the interface, its own
 * for each world. The relief and the rose drift gently with the pointer, a
 * parallax that stops when motion is reduced or transparency is off. With
 * `draw`, the contour lines draw themselves when the atlas appears: the start
 * of the entry of a world.
 */
export function Atlas({
  seed,
  draw = false,
  still: alwaysStill = false,
}: {
  seed: string;
  draw?: boolean;
  /** A small atlas (a world's cover) that never follows the pointer. */
  still?: boolean;
}) {
  const relief = useMemo(() => atlasRelief(seed), [seed]);
  const transparency = useUiStore((state) => state.transparency);
  const reliefRef = useRef<SVGGElement>(null);
  const roseRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const still =
      alwaysStill ||
      transparency === "off" ||
      window.matchMedia(REDUCED_MOTION).matches ||
      window.matchMedia(REDUCED_TRANSPARENCY).matches;
    const place = (dx: number, dy: number) => {
      if (reliefRef.current) {
        reliefRef.current.style.transform = `translate(${dx * DEPTH.relief}px, ${dy * DEPTH.relief}px)`;
      }
      if (roseRef.current) {
        roseRef.current.style.transform = `translate(${dx * DEPTH.rose}px, ${dy * DEPTH.rose}px)`;
      }
    };
    place(0, 0);
    if (still) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // From -1 to 1 across the window; the map leans away from the pointer.
        const dx = (event.clientX / window.innerWidth) * 2 - 1;
        const dy = (event.clientY / window.innerHeight) * 2 - 1;
        place(-dx, -dy);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
    };
  }, [transparency, alwaysStill]);

  // Shrunk into a cover, the lines keep their width instead of vanishing.
  const lineEffect = alwaysStill ? "non-scaling-stroke" : undefined;
  const graticule = [];
  for (let x = 100; x < ATLAS_WIDTH; x += 200) {
    graticule.push(<line key={`x${x}`} x1={x} y1={-40} x2={x} y2={ATLAS_HEIGHT + 40} />);
  }
  for (let y = 100; y < ATLAS_HEIGHT; y += 200) {
    graticule.push(<line key={`y${y}`} x1={-40} y1={y} x2={ATLAS_WIDTH + 40} y2={y} />);
  }

  return (
    <svg
      aria-hidden
      data-testid="atlas"
      viewBox={`0 0 ${ATLAS_WIDTH} ${ATLAS_HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute -inset-4 size-[calc(100%+2rem)]"
    >
      <g stroke="var(--bz-atlas-sea)" strokeWidth={0.8} strokeDasharray="2 6">
        {graticule}
      </g>
      <g ref={reliefRef} className={DRIFT} fill="none">
        <g stroke="var(--bz-atlas-ink)" strokeWidth={0.9}>
          {relief.contours.map((d) => (
            <path
              key={d}
              d={d}
              pathLength={1}
              className={draw ? "atlas-draw" : undefined}
              vectorEffect={lineEffect}
            />
          ))}
        </g>
        <g stroke="var(--bz-atlas-ink-strong)" strokeWidth={1.3}>
          {relief.indexContours.map((d) => (
            <path
              key={d}
              d={d}
              pathLength={1}
              className={draw ? "atlas-draw" : undefined}
              vectorEffect={lineEffect}
            />
          ))}
        </g>
      </g>
      <g ref={roseRef} className={DRIFT}>
        <CompassRose x={ATLAS_WIDTH - 190} y={ATLAS_HEIGHT - 170} size={110} />
      </g>
    </svg>
  );
}
