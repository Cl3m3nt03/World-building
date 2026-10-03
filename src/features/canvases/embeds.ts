/**
 * World documents on a canvas (M7 steps 7.4 and 7.5, docs/features/06-canvas.md):
 * a card, a map, a graph or a tree is an Excalidraw « embeddable » element
 * whose link names the document; BuilderZ draws it (DocumentThumbnail),
 * Excalidraw moves, resizes and saves it like any element. The link's host
 * is reserved (`.invalid`, RFC 2606): nothing is ever loaded from it.
 * Pure functions, tested in embeds.test.ts.
 */

const LINK = "https://builderz.invalid/";

/** The documents a canvas can show. */
export const EMBED_KINDS = ["card", "map", "graph", "tree"] as const;
export type EmbedKind = (typeof EMBED_KINDS)[number];
export type Embed = { kind: EmbedKind; id: string };

/** Size of a document's thumbnail when it is placed, in scene units. */
export function embedSize(kind: EmbedKind): { width: number; height: number } {
  return kind === "card" ? { width: 200, height: 160 } : { width: 320, height: 220 };
}

/** The link of a document's element. */
export function embedLink({ kind, id }: Embed): string {
  return `${LINK}${kind}/${encodeURIComponent(id)}`;
}

/** The document an element's link names, or `null` for any other link. */
export function embedOf(link: string | null | undefined): Embed | null {
  if (!link?.startsWith(LINK)) return null;
  const [kind, id, ...rest] = link.slice(LINK.length).split("/");
  if (rest.length > 0 || !id || !(EMBED_KINDS as readonly string[]).includes(kind ?? "")) {
    return null;
  }
  return { kind: kind as EmbedKind, id: decodeURIComponent(id) };
}

/** An element as far as finding the document under the pointer goes. */
export type PlacedElement = {
  type: string;
  link?: string | null;
  isDeleted?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
};

/**
 * The document drawn at scene point (`x`, `y`): the topmost one there (the
 * last in the scene's order), or `null`.
 */
export function embedAt(elements: readonly PlacedElement[], x: number, y: number): Embed | null {
  for (let index = elements.length - 1; index >= 0; index--) {
    const element = elements[index];
    if (!element || element.isDeleted || element.type !== "embeddable") continue;
    const embed = embedOf(element.link);
    if (!embed) continue;
    // A rotated element is hit in its own frame.
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    const angle = -(element.angle ?? 0);
    const dx = x - cx;
    const dy = y - cy;
    const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
    if (Math.abs(lx) <= element.width / 2 && Math.abs(ly) <= element.height / 2) return embed;
  }
  return null;
}

/** The top left corner of a document placed at scene point (`x`, `y`): centred on it. */
export function placeAt(kind: EmbedKind, x: number, y: number): { x: number; y: number } {
  const { width, height } = embedSize(kind);
  return { x: x - width / 2, y: y - height / 2 };
}
