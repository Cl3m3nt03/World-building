import { TYPE_COLORS, typeColor } from "@/features/card-types";
import type { TranslationKey } from "@/i18n";
import type { TreeAnnotation, VariantContent } from "@/lib/bindings";

/**
 * Annotations of a tree (M6 step 6.7, docs/features/05-relation-tree.md):
 * free-hand strokes and free texts drawn over it, in tree coordinates.
 * Pure functions, tested in annotations.test.ts.
 */

export type Drawing = Extract<TreeAnnotation, { kind: "drawing" }>;
export type FreeText = Extract<TreeAnnotation, { kind: "text" }>;

/** Colours an annotation can take: the text's own, then the types' palette (theme-aware). */
export const ANNOTATION_COLORS = ["ink", "muted", ...TYPE_COLORS] as const;
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];

/** Pen widths and text sizes offered, in tree units. */
export const PEN_WIDTHS = [2, 4, 8, 14] as const;
export const TEXT_SIZES = [14, 20, 32] as const;

/** Most points a stroke keeps (the Rust side refuses more). */
const MAX_POINTS = 10_000;
/** A point closer than this to the previous one is dropped. */
const MIN_STEP = 2;

/** CSS colour of an annotation colour name. */
export function annotationColor(name: string): string {
  if (name === "ink") return "var(--foreground)";
  if (name === "muted") return "var(--muted-foreground)";
  return typeColor(name);
}

/** Accessible name of an annotation colour. */
export function annotationColorLabel(name: string): TranslationKey {
  if (name === "ink") return "trees.annotations.colors.ink";
  if (name === "muted") return "trees.annotations.colors.muted";
  return (TYPE_COLORS as readonly string[]).includes(name)
    ? (`cardTypes.color.${name}` as TranslationKey)
    : "cardTypes.color.slate";
}

/**
 * Adds point (`x`, `y`) to a stroke's points, unless it is too close to the
 * last one or the stroke is full. Returns the same array when nothing changes.
 */
export function extendStroke(points: [number, number][], x: number, y: number): [number, number][] {
  const last = points.at(-1);
  if (last && Math.hypot(x - last[0], y - last[1]) < MIN_STEP) return points;
  if (points.length >= MAX_POINTS) return points;
  return [...points, [x, y]];
}

/** A stroke from its points (a single point becomes a dot: two equal points). */
export function newDrawing(points: [number, number][], color: string, width: number): Drawing {
  const first = points[0] ?? [0, 0];
  const kept: [number, number][] = points.length >= 2 ? points : [first, first];
  return { kind: "drawing", id: crypto.randomUUID(), points: kept, color, width };
}

export function newText(x: number, y: number, color: string, size: number): FreeText {
  return { kind: "text", id: crypto.randomUUID(), x, y, text: "", color, size };
}

export function addAnnotation(content: VariantContent, annotation: TreeAnnotation): VariantContent {
  return { ...content, annotations: [...content.annotations, annotation] };
}

export function removeAnnotation(content: VariantContent, id: string): VariantContent {
  return { ...content, annotations: content.annotations.filter((a) => a.id !== id) };
}

/** Changes a text's words (empty: the text goes), colour or size. */
export function updateText(
  content: VariantContent,
  id: string,
  patch: Partial<Pick<FreeText, "text" | "color" | "size">>,
): VariantContent {
  if (patch.text !== undefined && patch.text.trim() === "") return removeAnnotation(content, id);
  return {
    ...content,
    annotations: content.annotations.map((a) =>
      a.id === id && a.kind === "text"
        ? { ...a, ...patch, ...(patch.text === undefined ? {} : { text: patch.text.trim() }) }
        : a,
    ),
  };
}

/** Changes a stroke's colour or width. */
export function updateDrawing(
  content: VariantContent,
  id: string,
  patch: Partial<Pick<Drawing, "color" | "width">>,
): VariantContent {
  return {
    ...content,
    annotations: content.annotations.map((a) =>
      a.id === id && a.kind === "drawing" ? { ...a, ...patch } : a,
    ),
  };
}

/** Moves an annotation by (`dx`, `dy`). */
export function moveAnnotation(
  content: VariantContent,
  id: string,
  dx: number,
  dy: number,
): VariantContent {
  return {
    ...content,
    annotations: content.annotations.map((a) => {
      if (a.id !== id) return a;
      if (a.kind === "text") return { ...a, x: (a.x ?? 0) + dx, y: (a.y ?? 0) + dy };
      return {
        ...a,
        points: a.points.map(([x, y]) => [(x ?? 0) + dx, (y ?? 0) + dy] as [number, number]),
      };
    }),
  };
}

/** The SVG path of a stroke. */
export function strokePath(points: readonly (readonly [number | null, number | null])[]): string {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x ?? 0} ${y ?? 0}`).join(" ");
}
