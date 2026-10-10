import type { BookStyle, Cover } from "@/lib/bindings";

/** The font of the titles on covers (shipped with the app, see the wiki's fonts). */
export const COVER_FONT = '"Playfair Display Variable", Georgia, serif';

/** Whether text on `hex` should be light (a dark book) or dark. */
export function lightText(hex: string): boolean {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 150;
}

/** `text` broken into lines no wider than `maxWidth`, as `measure` says. */
export function wrapLines(
  text: string,
  measure: (line: string) => number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A small pseudo-random generator: the same grain at every drawing. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** The book's colour with the texture of its finish, over the whole area. */
export function drawFinish(
  ctx: CanvasRenderingContext2D,
  style: BookStyle,
  width: number,
  height: number,
) {
  ctx.fillStyle = style.color;
  ctx.fillRect(0, 0, width, height);
  const unit = Math.max(2, Math.round(width / 160));
  if (style.finish === "cloth") {
    // A weave: fine light and dark diagonals.
    ctx.lineWidth = unit / 2;
    for (let x = -height; x < width; x += unit * 3) {
      ctx.strokeStyle = "rgb(255 255 255 / 0.05)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height, height);
      ctx.stroke();
      ctx.strokeStyle = "rgb(0 0 0 / 0.06)";
      ctx.beginPath();
      ctx.moveTo(x + height, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  } else if (style.finish === "leather") {
    // A sheen, a shade, and a grain.
    const sheen = ctx.createRadialGradient(
      width * 0.3,
      height * 0.2,
      0,
      width * 0.3,
      height * 0.2,
      width,
    );
    sheen.addColorStop(0, "rgb(255 255 255 / 0.16)");
    sheen.addColorStop(0.6, "rgb(255 255 255 / 0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, width, height);
    const shade = ctx.createRadialGradient(
      width * 0.7,
      height * 0.8,
      0,
      width * 0.7,
      height * 0.8,
      width * 0.8,
    );
    shade.addColorStop(0, "rgb(0 0 0 / 0.25)");
    shade.addColorStop(0.55, "rgb(0 0 0 / 0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
    const next = random(7);
    for (let i = 0; i < (width * height) / (unit * unit * 6); i++) {
      ctx.fillStyle = next() < 0.5 ? "rgb(0 0 0 / 0.07)" : "rgb(255 255 255 / 0.04)";
      ctx.fillRect(next() * width, next() * height, unit, unit);
    }
  } else {
    const light = ctx.createLinearGradient(0, 0, 0, height);
    light.addColorStop(0, "rgb(255 255 255 / 0.06)");
    light.addColorStop(1, "rgb(0 0 0 / 0.06)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, height);
  }
}

/** What a cover shows: the story's title, its book and its illustration. */
export type CoverArt = {
  title: string;
  bookStyle: BookStyle;
  cover: Cover;
  /** The illustration, once loaded (none while it loads or without one). */
  image: { source: CanvasImageSource; width: number; height: number } | null;
};

/** Draws `image` so that it covers the box (like CSS `object-fit: cover`). */
function drawCovering(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  size: { width: number; height: number },
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / size.width, height / size.height);
  const w = width / scale;
  const h = height / scale;
  ctx.drawImage(image, (size.width - w) / 2, (size.height - h) / 2, w, h, x, y, width, height);
}

/**
 * The front of the book, as the 2D preview shows it (`BookCover`): the
 * finish, the illustration framed by the book's colour, the spine's fold and
 * the title at its place.
 */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  art: CoverArt,
) {
  const { bookStyle, cover } = art;
  drawFinish(ctx, bookStyle, width, height);
  const hasImage = art.image !== null;
  if (art.image) {
    const x = width * 0.11;
    const y = height * 0.05;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, width * 0.83, height * 0.9, width * 0.015);
    ctx.clip();
    drawCovering(ctx, art.image.source, art.image, x, y, width * 0.83, height * 0.9);
    ctx.restore();
  }
  const fold = ctx.createLinearGradient(0, 0, width * 0.07, 0);
  fold.addColorStop(0, "rgb(0 0 0 / 0.35)");
  fold.addColorStop(1, "rgb(0 0 0 / 0)");
  ctx.fillStyle = fold;
  ctx.fillRect(0, 0, width * 0.07, height);

  const light = lightText(bookStyle.color);
  const size = Math.round(width * 0.1);
  ctx.font = `700 ${size}px ${COVER_FONT}`;
  const lines = wrapLines(art.title, (line) => ctx.measureText(line).width, width * 0.8);
  const lineHeight = size * 1.2;
  const block = lines.length * lineHeight;
  const position = cover.titlePosition;
  const top =
    position === "top"
      ? height * 0.12
      : position === "bottom"
        ? height * 0.88 - block
        : (height - block) / 2;
  // A shade behind the title on an illustration, for its contrast.
  if (hasImage) {
    const shade = light ? "0 0 0" : "255 255 255";
    if (position === "middle") {
      ctx.fillStyle = `rgb(${shade} / ${light ? 0.45 : 0.6})`;
      const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
      ctx.beginPath();
      ctx.roundRect(
        (width - widest) / 2 - size * 0.3,
        top - size * 0.2,
        widest + size * 0.6,
        block + size * 0.2,
        size * 0.15,
      );
      ctx.fill();
    } else {
      const from = position === "top" ? 0 : height;
      const to = position === "top" ? top + block + height * 0.08 : top - height * 0.08;
      const gradient = ctx.createLinearGradient(0, from, 0, to);
      gradient.addColorStop(0, `rgb(${shade} / ${light ? 0.6 : 0.7})`);
      gradient.addColorStop(1, `rgb(${shade} / 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, Math.min(from, to), width, Math.abs(to - from));
    }
  }
  ctx.fillStyle = light ? "rgb(250 246 236)" : "rgb(32 28 24)";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, top + index * lineHeight);
  });
}

/** The spine: the finish and the title written along it, top to bottom. */
export function drawSpine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  style: BookStyle,
) {
  drawFinish(ctx, style, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(Math.PI / 2);
  const size = Math.round(width * 0.42);
  ctx.font = `700 ${size}px ${COVER_FONT}`;
  ctx.fillStyle = lightText(style.color) ? "rgb(250 246 236)" : "rgb(32 28 24)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let line = title;
  while (line.length > 1 && ctx.measureText(line).width > height * 0.8) {
    line = `${line.slice(0, -2)}…`;
  }
  ctx.fillText(line, 0, 0);
  ctx.restore();
}

/**
 * The edges of the pages: cream, with a fine line per sheet, running along
 * the length of the edge (`across`: the sheets are stacked along the width).
 */
export function drawPages(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  across: boolean,
) {
  ctx.fillStyle = "rgb(240 233 216)";
  ctx.fillRect(0, 0, width, height);
  const next = random(11);
  ctx.lineWidth = 1;
  const span = across ? width : height;
  for (let at = 0; at < span; at += 3) {
    ctx.strokeStyle = `rgb(150 135 110 / ${0.08 + next() * 0.12})`;
    ctx.beginPath();
    if (across) {
      ctx.moveTo(at, 0);
      ctx.lineTo(at, height);
    } else {
      ctx.moveTo(0, at);
      ctx.lineTo(width, at);
    }
    ctx.stroke();
  }
}
