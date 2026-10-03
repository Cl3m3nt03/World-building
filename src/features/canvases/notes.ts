import type { TranslationKey } from "@/i18n";

/**
 * Notes of a canvas (M7 step 7.6, docs/features/06-canvas.md): post-its with
 * a title and a text, on coloured paper, plain or ruled. A note is an
 * Excalidraw « embeddable » element with BuilderZ's note link; what it says
 * is in the element's `customData`, saved with the scene. Pure functions,
 * tested in notes.test.ts.
 */

export const NOTE_LINK = "https://builderz.invalid/note";

/** Size of a new note, in scene units. */
export const NOTE_SIZE = { width: 220, height: 160 } as const;

/**
 * Paper colours. They are scene data, like the drawing colours: a note is
 * paper, the same in both themes (as on the board), with dark ink.
 */
export const NOTE_COLORS = [
  { value: "yellow", paper: "#fbf3d5", rule: "#e6d9a8", label: "canvases.colors.yellow" },
  { value: "pink", paper: "#f9e1e8", rule: "#e8bfcb", label: "canvases.colors.pink" },
  { value: "violet", paper: "#ece4f7", rule: "#d3c4ea", label: "canvases.colors.violet" },
  { value: "blue", paper: "#e3edf9", rule: "#c3d5ee", label: "canvases.colors.blue" },
  { value: "green", paper: "#e2f2e2", rule: "#c0dfc0", label: "canvases.colors.green" },
  { value: "white", paper: "#fbfbf8", rule: "#dcdcd4", label: "canvases.colors.white" },
] as const satisfies readonly {
  value: string;
  paper: string;
  rule: string;
  label: TranslationKey;
}[];

/** Ink of a note's text (dark on every paper). */
export const NOTE_INK = "#2b2620";

export const NOTE_PATTERNS = ["lined", "grid", "dotted", "plain"] as const;

export type NoteColor = (typeof NOTE_COLORS)[number]["value"];
export type NotePattern = (typeof NOTE_PATTERNS)[number];
export type Note = { title: string; text: string; color: NoteColor; pattern: NotePattern };

/** Longest title and text kept (a note is short). */
const MAX_TITLE = 200;
const MAX_TEXT = 10_000;

export const NEW_NOTE: Note = { title: "", text: "", color: "yellow", pattern: "lined" };

export function isNoteLink(link: string | null | undefined): boolean {
  return link === NOTE_LINK;
}

function oneOf<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
  return (values as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

/**
 * The note an element holds (its `customData`), anything missing or wrong
 * replaced by the default: a damaged note still opens.
 */
export function noteOf(customData: unknown): Note {
  const data = (typeof customData === "object" && customData !== null ? customData : {}) as Record<
    string,
    unknown
  >;
  return {
    title: typeof data.title === "string" ? data.title.slice(0, MAX_TITLE) : "",
    text: typeof data.text === "string" ? data.text.slice(0, MAX_TEXT) : "",
    color: oneOf(
      NOTE_COLORS.map((color) => color.value),
      data.color,
      NEW_NOTE.color,
    ),
    pattern: oneOf(NOTE_PATTERNS, data.pattern, NEW_NOTE.pattern),
  };
}

/** The paper and rule colours of a note colour. */
export function paperOf(color: NoteColor): { paper: string; rule: string } {
  const found = NOTE_COLORS.find((each) => each.value === color) ?? NOTE_COLORS[0];
  return { paper: found.paper, rule: found.rule };
}

/** The CSS background of a note: its paper, ruled with its pattern. */
export function noteBackground({ color, pattern }: Pick<Note, "color" | "pattern">): {
  backgroundColor: string;
  backgroundImage?: string;
  backgroundSize?: string;
} {
  const { paper, rule } = paperOf(color);
  if (pattern === "lined") {
    return {
      backgroundColor: paper,
      backgroundImage: `linear-gradient(to bottom, transparent 23px, ${rule} 23px, ${rule} 24px)`,
      backgroundSize: "100% 24px",
    };
  }
  if (pattern === "grid") {
    return {
      backgroundColor: paper,
      backgroundImage: `linear-gradient(to bottom, ${rule} 1px, transparent 1px), linear-gradient(to right, ${rule} 1px, transparent 1px)`,
      backgroundSize: "16px 16px",
    };
  }
  if (pattern === "dotted") {
    return {
      backgroundColor: paper,
      backgroundImage: `radial-gradient(circle, ${rule} 1.2px, transparent 1.4px)`,
      backgroundSize: "16px 16px",
    };
  }
  return { backgroundColor: paper };
}
