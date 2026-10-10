/** How the 3D book is turned: around its height (yaw) and a little forward (tilt). */
export type Turn = { yaw: number; tilt: number };

/** At rest: a three-quarter view that shows the spine. */
export const REST: Turn = { yaw: 0.45, tilt: -0.08 };

/** One arrow key turns the book by this much (radians, 15°). */
export const STEP = Math.PI / 12;

const MAX_TILT = 0.5;

/** The turn after dragging by (dx, dy) pixels. */
export function dragged(turn: Turn, dx: number, dy: number): Turn {
  return {
    yaw: turn.yaw + dx * 0.01,
    tilt: Math.min(MAX_TILT, Math.max(-MAX_TILT, turn.tilt + dy * 0.005)),
  };
}

/** The turn after a key, or null for a key that does not turn the book. */
export function keyed(turn: Turn, key: string): Turn | null {
  switch (key) {
    case "ArrowLeft":
      return { ...turn, yaw: turn.yaw - STEP };
    case "ArrowRight":
      return { ...turn, yaw: turn.yaw + STEP };
    case "ArrowUp":
      return { ...turn, tilt: Math.max(-MAX_TILT, turn.tilt - STEP / 2) };
    case "ArrowDown":
      return { ...turn, tilt: Math.min(MAX_TILT, turn.tilt + STEP / 2) };
    case "Home":
      return REST;
    default:
      return null;
  }
}

/** One frame of the way from `current` to `target`; null once arrived. */
export function eased(current: Turn, target: Turn): Turn | null {
  const yaw = target.yaw - current.yaw;
  const tilt = target.tilt - current.tilt;
  if (Math.abs(yaw) < 0.001 && Math.abs(tilt) < 0.001) return null;
  return { yaw: current.yaw + yaw * 0.2, tilt: current.tilt + tilt * 0.2 };
}
