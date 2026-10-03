/**
 * Sections of a canvas (M7 step 7.8, docs/features/06-canvas.md): Excalidraw
 * frames, named, that carry what is inside them. Excalidraw files what is
 * drawn or moved into a frame; these help with what BuilderZ adds itself (a
 * card dropped, a document inserted, a note, a cloud). Pure functions,
 * tested in sections.test.ts.
 */

type Box = { x: number; y: number; width: number; height: number };
export type FrameLike = Box & {
  id: string;
  type: string;
  isDeleted?: boolean;
  name?: string | null;
};

/**
 * The section a new element in `box` belongs to: the topmost frame (the
 * last in the scene's order) that holds the whole box, or `null`.
 */
export function frameAround(elements: readonly FrameLike[], box: Box): string | null {
  for (let index = elements.length - 1; index >= 0; index--) {
    const frame = elements[index];
    if (!frame || frame.isDeleted || frame.type !== "frame") continue;
    if (
      box.x >= frame.x &&
      box.y >= frame.y &&
      box.x + box.width <= frame.x + frame.width &&
      box.y + box.height <= frame.y + frame.height
    ) {
      return frame.id;
    }
  }
  return null;
}

/**
 * Where a new element goes in the scene's order: right before its section
 * (as Excalidraw keeps a frame after what it holds), at the end otherwise.
 */
export function insertionIndex(
  elements: readonly { id: string }[],
  frameId: string | null,
): number {
  const at = frameId ? elements.findIndex((element) => element.id === frameId) : -1;
  return at >= 0 ? at : elements.length;
}

/** The sections not named yet (Excalidraw would call them « Frame »). */
export function unnamedFrames(elements: readonly FrameLike[]): string[] {
  return elements
    .filter((element) => element.type === "frame" && !element.isDeleted && !element.name)
    .map((element) => element.id);
}

/** « Section 3 » for the third section: the first number no section uses yet. */
export function sectionName(base: string, names: readonly (string | null | undefined)[]): string {
  const used = new Set(names);
  let number = names.filter(Boolean).length + 1;
  while (used.has(`${base} ${number}`)) number++;
  return `${base} ${number}`;
}
