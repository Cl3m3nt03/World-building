/**
 * Cards on a canvas (M7 step 7.4, docs/features/06-canvas.md): a card is an
 * Excalidraw « embeddable » element whose link names the card; BuilderZ
 * draws it (CardThumbnail), Excalidraw moves, resizes and saves it like any
 * element. The link's host is reserved (`.invalid`, RFC 2606): nothing is
 * ever loaded from it. Pure functions, tested in cardElements.test.ts.
 */

const CARD_LINK = "https://builderz.invalid/card/";

/** Size of a card's thumbnail when it is dropped, in scene units. */
export const CARD_WIDTH = 200;
export const CARD_HEIGHT = 160;

/** The link of a card's element. */
export function cardLink(cardId: string): string {
  return `${CARD_LINK}${encodeURIComponent(cardId)}`;
}

/** The card an element's link names, or `null` for any other link. */
export function cardIdOf(link: string | null | undefined): string | null {
  if (!link?.startsWith(CARD_LINK)) return null;
  const id = decodeURIComponent(link.slice(CARD_LINK.length));
  return id.length > 0 && !id.includes("/") ? id : null;
}

/** An element as far as finding the card under the pointer goes. */
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
 * The card drawn at scene point (`x`, `y`): the topmost card element there
 * (the last one in the scene's order), or `null`.
 */
export function cardAt(elements: readonly PlacedElement[], x: number, y: number): string | null {
  for (let index = elements.length - 1; index >= 0; index--) {
    const element = elements[index];
    if (!element || element.isDeleted || element.type !== "embeddable") continue;
    const id = cardIdOf(element.link);
    if (!id) continue;
    // A rotated card is hit in its own frame.
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    const angle = -(element.angle ?? 0);
    const dx = x - cx;
    const dy = y - cy;
    const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
    if (Math.abs(lx) <= element.width / 2 && Math.abs(ly) <= element.height / 2) return id;
  }
  return null;
}

/** The top left corner of a card dropped at scene point (`x`, `y`): centred on it. */
export function dropOrigin(x: number, y: number): { x: number; y: number } {
  return { x: x - CARD_WIDTH / 2, y: y - CARD_HEIGHT / 2 };
}
