import type { TranslationKey } from "@/i18n";

/**
 * The canvas's tools and their options (M7 step 7.3, docs/features/06-canvas.md):
 * what the BuilderZ toolbar offers on top of Excalidraw, and how a style
 * picked there reaches the next element and the selected ones.
 * Pure functions, tested in tools.test.ts.
 */

/** Excalidraw's tools the toolbar drives. */
export type ToolType =
  | "selection"
  | "hand"
  | "freedraw"
  | "eraser"
  | "text"
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "arrow"
  | "line"
  | "frame";

/** The shapes, in the order of the board. */
export const SHAPES = ["arrow", "line", "rectangle", "ellipse", "diamond"] as const;
export type Shape = (typeof SHAPES)[number];

export function isShape(tool: string): tool is Shape {
  return (SHAPES as readonly string[]).includes(tool);
}

/**
 * Stroke colours. They are scene data, not interface colours: Excalidraw
 * draws them on its canvas and inverts the canvas in the dark theme, so the
 * ink shows dark on a light canvas and light on a dark one.
 */
export const STROKE_COLORS = [
  { value: "#1e1e1e", label: "canvases.colors.ink" },
  { value: "#868e96", label: "canvases.colors.gray" },
  { value: "#e03131", label: "canvases.colors.red" },
  { value: "#f08c00", label: "canvases.colors.orange" },
  { value: "#f2c200", label: "canvases.colors.yellow" },
  { value: "#2f9e44", label: "canvases.colors.green" },
  { value: "#1971c2", label: "canvases.colors.blue" },
  { value: "#7048e8", label: "canvases.colors.violet" },
  { value: "#c2255c", label: "canvases.colors.pink" },
] as const satisfies readonly { value: string; label: TranslationKey }[];

/** Fill colours: none, then light tints of the stroke colours. */
export const FILL_COLORS = [
  { value: "transparent", label: "canvases.colors.none" },
  { value: "#e9ecef", label: "canvases.colors.gray" },
  { value: "#ffc9c9", label: "canvases.colors.red" },
  { value: "#ffd8a8", label: "canvases.colors.orange" },
  { value: "#ffec99", label: "canvases.colors.yellow" },
  { value: "#b2f2bb", label: "canvases.colors.green" },
  { value: "#a5d8ff", label: "canvases.colors.blue" },
  { value: "#d0bfff", label: "canvases.colors.violet" },
  { value: "#fcc2d7", label: "canvases.colors.pink" },
] as const satisfies readonly { value: string; label: TranslationKey }[];

export const FILL_STYLES = ["hachure", "cross-hatch", "solid"] as const;
export const STROKE_WIDTHS = [1, 2, 4, 8] as const;
export const STROKE_STYLES = ["solid", "dashed", "dotted"] as const;
/** Excalidraw's roughness: 1 drawn by hand, 0 clean. */
export const ROUGHNESS = [1, 0] as const;
export const FONT_SIZES = [16, 20, 28, 36] as const;

/** A style the options bar can set. */
export type StyleKey =
  | "strokeColor"
  | "backgroundColor"
  | "fillStyle"
  | "strokeWidth"
  | "strokeStyle"
  | "roughness"
  | "fontSize";

export type Style = {
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  fontSize: number;
};

/** Excalidraw's app state field holding the style of the next element. */
export const CURRENT_ITEM: Record<StyleKey, string> = {
  strokeColor: "currentItemStrokeColor",
  backgroundColor: "currentItemBackgroundColor",
  fillStyle: "currentItemFillStyle",
  strokeWidth: "currentItemStrokeWidth",
  strokeStyle: "currentItemStrokeStyle",
  roughness: "currentItemRoughness",
  fontSize: "currentItemFontSize",
};

/** The styles that mean something for an element (or a tool) of this type. */
export function stylesOf(type: string): StyleKey[] {
  if (type === "freedraw") return ["strokeColor", "strokeWidth"];
  if (type === "text") return ["strokeColor", "fontSize"];
  if (type === "arrow" || type === "line") {
    return ["strokeColor", "strokeWidth", "strokeStyle", "roughness"];
  }
  if (type === "rectangle" || type === "ellipse" || type === "diamond") {
    return [
      "strokeColor",
      "backgroundColor",
      "fillStyle",
      "strokeWidth",
      "strokeStyle",
      "roughness",
    ];
  }
  return [];
}

/** An element as far as styling goes. */
export type StyledElement = {
  id: string;
  type: string;
  isDeleted?: boolean;
  width: number;
  height: number;
  containerId?: string | null;
} & Partial<Style>;

/**
 * The options to show: those of the active drawing tool, or with the
 * selection tool, those every selected element shares (`selected` empty:
 * nothing to style).
 */
export function optionsFor(tool: string, selected: readonly StyledElement[]): StyleKey[] {
  if (tool !== "selection") return stylesOf(tool);
  if (selected.length === 0) return [];
  const [first, ...rest] = selected.map((element) => stylesOf(element.type));
  return (first ?? []).filter((key) => rest.every((keys) => keys.includes(key)));
}

/**
 * The value shown for a style: the selected elements' when they all agree,
 * none when they differ, the next element's otherwise.
 */
export function shownValue<K extends StyleKey>(
  key: K,
  selected: readonly StyledElement[],
  current: Style,
): Style[K] | undefined {
  if (selected.length === 0) return current[key];
  const values = new Set(selected.map((element) => element[key]));
  return values.size === 1 ? (selected[0]?.[key] as Style[K]) : undefined;
}

/**
 * What changes on each selected element when `key` takes `value`: the
 * elements for which the style means something. A text keeps its look when
 * its font size changes: its box grows or shrinks with it.
 */
export function stylePatches<K extends StyleKey>(
  selected: readonly StyledElement[],
  key: K,
  value: Style[K],
): Map<string, Partial<StyledElement>> {
  const patches = new Map<string, Partial<StyledElement>>();
  for (const element of selected) {
    if (element.isDeleted || !stylesOf(element.type).includes(key)) continue;
    if (key === "fontSize") {
      const ratio = Number(value) / (element.fontSize || Number(value));
      patches.set(element.id, {
        fontSize: Number(value),
        width: element.width * ratio,
        height: element.height * ratio,
      });
    } else {
      patches.set(element.id, { [key]: value });
    }
  }
  return patches;
}
