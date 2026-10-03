import {
  ArrowUpRight,
  Circle,
  Cloud,
  Diamond,
  Eraser,
  Frame,
  Hand,
  ImagePlus,
  LayoutGrid,
  MessageCircle,
  Minus,
  MousePointer2,
  Pencil,
  Shapes,
  Square,
  StickyNote,
  Trash2,
  Type,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChoiceTiles } from "@/features/card-types";
import type { TranslationKey } from "@/i18n";
import type { Embed } from "../embeds";
import {
  NOTE_COLORS,
  NOTE_PATTERNS,
  type Note,
  type NoteColor,
  type NotePattern,
  noteBackground,
} from "../notes";
import {
  FILL_COLORS,
  FILL_STYLES,
  FONT_SIZES,
  isShape,
  ROUGHNESS,
  SHAPES,
  type Shape,
  STROKE_COLORS,
  STROKE_STYLES,
  STROKE_WIDTHS,
  type Style,
  type StyleKey,
  type ToolType,
} from "../tools";
import { InsertPicker } from "./InsertPicker";

/** What the toolbar shows: the active tool and the options to offer. */
export type ToolbarState = {
  tool: string;
  /** Options to show, in this order. */
  options: StyleKey[];
  /** The value of each option (`undefined`: the selection mixes several). */
  values: Partial<Style>;
  /** Something is selected (it can be removed). */
  selection: boolean;
  /** Only notes are selected: their colour and paper (`undefined`: they differ). */
  note?: { color?: NoteColor | undefined; pattern?: NotePattern | undefined } | undefined;
};

type Props = ToolbarState & {
  /** The shape the « Shapes » button picks (the last one used). */
  shape: Shape;
  onTool: (tool: ToolType) => void;
  onStyle: <K extends StyleKey>(key: K, value: Style[K]) => void;
  onRemove: () => void;
  /** Places a card, map, graph or tree of the world in the middle of the view. */
  onInsert: (embed: Embed) => void;
  /** Places a new note in the middle of the view, to write in. */
  onNote: () => void;
  /** Sets the colour or paper of the selected notes. */
  onNoteStyle: (patch: Partial<Pick<Note, "color" | "pattern">>) => void;
};

const SHAPE_ICONS: Record<Shape, typeof Square> = {
  arrow: ArrowUpRight,
  line: Minus,
  rectangle: Square,
  ellipse: Circle,
  diamond: Diamond,
  cloud: Cloud,
  bubble: MessageCircle,
};

/** A tool of the bar: pressed while active; its name and shortcut as tooltip. */
function ToolButton({
  label,
  shortcut,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string | undefined;
  pressed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-pressed={disabled ? undefined : Boolean(pressed)}
      aria-label={label}
      aria-keyshortcuts={shortcut}
      title={shortcut ? `${label} — ${shortcut}` : label}
      disabled={disabled}
      className="aria-pressed:bg-secondary aria-pressed:text-foreground"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

/** A colour drawn as Excalidraw shows it (its canvas is inverted in the dark theme). */
function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="bz-canvas-swatch size-4 rounded-full border border-border"
      style={{ background: color === "transparent" ? undefined : color }}
    />
  );
}

/** Options as tiles: a radio group, one tab stop, arrows to move. */
function Choice<T extends string>({
  label,
  value,
  onChange,
  choices,
}: {
  label: string;
  value: T | undefined;
  onChange: (value: T) => void;
  choices: { value: T; label: string; content: ReactNode }[];
}) {
  return (
    <ChoiceTiles
      label={label}
      value={value ?? ("" as T)}
      onChange={onChange}
      className="flex-nowrap gap-1"
      tileClassName="size-7"
      choices={choices}
    />
  );
}

/** Dashes drawn for a stroke style. */
function StrokeLine({ style }: { style: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 4" className="w-4">
      <line
        x1="1"
        y1="2"
        x2="19"
        y2="2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={style === "dashed" ? "5 4" : style === "dotted" ? "0.1 4" : undefined}
      />
    </svg>
  );
}

/** The options of a style, in the options bar. */
function StyleOption({
  option,
  value,
  onStyle,
}: {
  option: StyleKey;
  value: Style[StyleKey] | undefined;
  onStyle: Props["onStyle"];
}) {
  const { t } = useTranslation();
  const text = (key: TranslationKey) => t(key);
  switch (option) {
    case "strokeColor":
      return (
        <Choice
          label={text("canvases.options.strokeColor")}
          value={value as string | undefined}
          onChange={(color) => onStyle("strokeColor", color)}
          choices={STROKE_COLORS.map((color) => ({
            value: color.value,
            label: text(color.label),
            content: <Swatch color={color.value} />,
          }))}
        />
      );
    case "backgroundColor":
      return (
        <Choice
          label={text("canvases.options.backgroundColor")}
          value={value as string | undefined}
          onChange={(color) => onStyle("backgroundColor", color)}
          choices={FILL_COLORS.map((color) => ({
            value: color.value,
            label: text(color.label),
            content: <Swatch color={color.value} />,
          }))}
        />
      );
    case "fillStyle":
      return (
        <Choice
          label={text("canvases.options.fillStyle")}
          value={value as string | undefined}
          onChange={(fill) => onStyle("fillStyle", fill)}
          choices={FILL_STYLES.map((fill) => ({
            value: fill,
            label: text(`canvases.options.fill.${fill}`),
            content: (
              <span
                aria-hidden
                className={`bz-canvas-fill bz-canvas-fill-${fill} size-4 rounded-sm border border-current`}
              />
            ),
          }))}
        />
      );
    case "strokeWidth":
      return (
        <Choice
          label={text("canvases.options.strokeWidth")}
          value={value === undefined ? undefined : String(value)}
          onChange={(width) => onStyle("strokeWidth", Number(width))}
          choices={STROKE_WIDTHS.map((width) => ({
            value: String(width),
            label: t("canvases.options.widthValue", { size: width }),
            content: (
              <span
                aria-hidden
                className="rounded-full bg-current"
                style={{ width: 3 + width * 1.2, height: 3 + width * 1.2 }}
              />
            ),
          }))}
        />
      );
    case "strokeStyle":
      return (
        <Choice
          label={text("canvases.options.strokeStyle")}
          value={value as string | undefined}
          onChange={(style) => onStyle("strokeStyle", style)}
          choices={STROKE_STYLES.map((style) => ({
            value: style,
            label: text(`canvases.options.stroke.${style}`),
            content: <StrokeLine style={style} />,
          }))}
        />
      );
    case "roughness":
      return (
        <Choice
          label={text("canvases.options.roughness")}
          value={value === undefined ? undefined : String(value)}
          onChange={(roughness) => onStyle("roughness", Number(roughness))}
          choices={ROUGHNESS.map((roughness) => ({
            value: String(roughness),
            label: text(roughness ? "canvases.options.drawn" : "canvases.options.clean"),
            content: (
              <svg aria-hidden viewBox="0 0 20 12" className="w-4">
                <path
                  d={roughness ? "M2 8 Q6 2 10 7 T18 5" : "M2 6 H18"}
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            ),
          }))}
        />
      );
    case "fontSize":
      return (
        <Choice
          label={text("canvases.options.fontSize")}
          value={value === undefined ? undefined : String(value)}
          onChange={(size) => onStyle("fontSize", Number(size))}
          choices={FONT_SIZES.map((size, index) => ({
            value: String(size),
            label: t("canvases.options.sizeValue", { size }),
            content: <Type aria-hidden style={{ width: 9 + index * 2, height: 9 + index * 2 }} />,
          }))}
        />
      );
  }
}

/**
 * Options shown together behind one button (as on the board, the bar stays
 * short): the fill (colour and pattern) and the line (stroke and look).
 */
const GROUPS: { keys: StyleKey[]; label: TranslationKey }[] = [
  { keys: ["backgroundColor", "fillStyle"], label: "canvases.options.backgroundColor" },
  { keys: ["strokeStyle", "roughness"], label: "canvases.options.strokeStyle" },
];

/** The options in bar order, the grouped ones as one entry. */
function groupOptions(options: readonly StyleKey[]): StyleKey[][] {
  const out: StyleKey[][] = [];
  for (const option of options) {
    const group = GROUPS.find(({ keys }) => keys.includes(option));
    if (!group) out.push([option]);
    else if (!out.some((entry) => entry.includes(option))) {
      out.push(group.keys.filter((key) => options.includes(key)));
    }
  }
  return out;
}

/** A group of options in a popover above its button. */
function StyleGroup({
  group,
  values,
  onStyle,
}: {
  group: StyleKey[];
  values: Partial<Style>;
  onStyle: Props["onStyle"];
}) {
  const { t } = useTranslation();
  const label = t(
    GROUPS.find(({ keys }) => keys.includes(group[0] as StyleKey))?.label ??
      "canvases.options.label",
  );
  const fill = group.includes("backgroundColor");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} title={label}>
          {fill ? (
            <Swatch color={values.backgroundColor ?? "transparent"} />
          ) : (
            <StrokeLine style={values.strokeStyle ?? "solid"} />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="glass flex w-auto flex-col gap-2 p-2"
        // Escape closes the popover only: Excalidraw would also drop the tool.
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
        {group.map((option) => (
          <div key={option} className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t(OPTION_LABELS[option])}</span>
            <StyleOption option={option} value={values[option]} onStyle={onStyle} />
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

const OPTION_LABELS: Record<StyleKey, TranslationKey> = {
  strokeColor: "canvases.options.strokeColor",
  backgroundColor: "canvases.options.backgroundColor",
  fillStyle: "canvases.options.fillStyle",
  strokeWidth: "canvases.options.strokeWidth",
  strokeStyle: "canvases.options.strokeStyle",
  roughness: "canvases.options.roughness",
  fontSize: "canvases.options.fontSize",
};

/**
 * The tools floating at the bottom of a canvas, as on the board: select,
 * pan, pen, notes, text, shapes, insert, section, images. Above them, the
 * active tool's own tools (pen or eraser, the shapes) and the style options
 * of the tool or of the selection. Excalidraw's own keys still work.
 */
export function CanvasToolbar({
  tool,
  options,
  values,
  selection,
  shape,
  onTool,
  onStyle,
  onRemove,
  onInsert,
  onNote,
  onNoteStyle,
  note,
}: Props) {
  const { t } = useTranslation();
  const drawing = tool === "freedraw" || tool === "eraser";
  const shaping = isShape(tool);
  const soon = t("canvases.tools.soon");
  const ShapeIcon = SHAPE_ICONS[shape];

  const subTools = drawing ? (
    <>
      <ToolButton
        label={t("canvases.tools.pen")}
        shortcut="P"
        pressed={tool === "freedraw"}
        onClick={() => onTool("freedraw")}
      >
        <Pencil />
      </ToolButton>
      <ToolButton
        label={t("canvases.tools.eraser")}
        shortcut="E"
        pressed={tool === "eraser"}
        onClick={() => onTool("eraser")}
      >
        <Eraser />
      </ToolButton>
    </>
  ) : shaping ? (
    SHAPES.map((value) => {
      const Icon = SHAPE_ICONS[value];
      return (
        <ToolButton
          key={value}
          label={t(`canvases.shapes.${value}`)}
          shortcut={SHAPE_KEYS[value]}
          pressed={tool === value}
          onClick={() => onTool(value)}
        >
          <Icon />
        </ToolButton>
      );
    })
  ) : null;

  const groups = groupOptions(options);
  const showOptions = subTools !== null || options.length > 0 || selection;
  const noteOptions = note ? (
    <>
      <Choice
        label={t("canvases.notes.color")}
        value={note.color}
        onChange={(color) => onNoteStyle({ color })}
        choices={NOTE_COLORS.map((color) => ({
          value: color.value,
          label: t(color.label),
          content: (
            <span
              aria-hidden
              className="size-4 rounded-full border border-border"
              style={{ background: color.paper }}
            />
          ),
        }))}
      />
      <Divider />
      <Choice
        label={t("canvases.notes.pattern")}
        value={note.pattern}
        onChange={(pattern) => onNoteStyle({ pattern })}
        choices={NOTE_PATTERNS.map((pattern) => ({
          value: pattern,
          label: t(`canvases.notes.patterns.${pattern}`),
          content: (
            <span
              aria-hidden
              className="size-4 rounded-sm border border-border"
              style={noteBackground({ color: note.color ?? "yellow", pattern })}
            />
          ),
        }))}
      />
    </>
  ) : null;

  return (
    <div className="bz-canvas-tools pointer-events-none flex min-w-0 max-w-full flex-col items-center gap-2">
      {showOptions && (
        <div
          role="toolbar"
          aria-label={t("canvases.options.label")}
          className="glass pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-lg border border-border p-1 shadow-sm"
        >
          {subTools}
          {noteOptions}
          {groups.map((group, index) => (
            <span key={group.join()} className="flex items-center">
              {(index > 0 || subTools) && <Divider />}
              {group.length === 1 ? (
                <StyleOption
                  option={group[0] as StyleKey}
                  value={values[group[0] as StyleKey]}
                  onStyle={onStyle}
                />
              ) : (
                <StyleGroup group={group} values={values} onStyle={onStyle} />
              )}
            </span>
          ))}
          {selection && (
            <>
              {(options.length > 0 || subTools || noteOptions) && <Divider />}
              <ToolButton label={t("canvases.options.remove")} shortcut="Delete" onClick={onRemove}>
                <Trash2 className="text-destructive" />
              </ToolButton>
            </>
          )}
        </div>
      )}
      <div
        role="toolbar"
        aria-label={t("canvases.tools.label")}
        className="glass pointer-events-auto flex items-center gap-1 rounded-lg border border-border p-1 shadow-sm"
      >
        <ToolButton
          label={t("canvases.tools.select")}
          shortcut="V"
          pressed={tool === "selection"}
          onClick={() => onTool("selection")}
        >
          <MousePointer2 />
        </ToolButton>
        <ToolButton
          label={t("canvases.tools.hand")}
          shortcut="H"
          pressed={tool === "hand"}
          onClick={() => onTool("hand")}
        >
          <Hand />
        </ToolButton>
        <Divider />
        <ToolButton
          label={t("canvases.tools.pen")}
          shortcut="P"
          pressed={drawing}
          onClick={() => onTool("freedraw")}
        >
          <Pencil />
        </ToolButton>
        <ToolButton label={t("canvases.tools.notes")} onClick={onNote}>
          <StickyNote />
        </ToolButton>
        <ToolButton
          label={t("canvases.tools.text")}
          shortcut="T"
          pressed={tool === "text"}
          onClick={() => onTool("text")}
        >
          <Type />
        </ToolButton>
        <ToolButton
          label={t("canvases.tools.shapes")}
          shortcut={SHAPE_KEYS[shape]}
          pressed={shaping}
          onClick={() => onTool(shape)}
        >
          {shaping ? <ShapeIcon /> : <Shapes />}
        </ToolButton>
        <Divider />
        <InsertPicker onInsert={onInsert}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("canvases.tools.insert")}
            title={t("canvases.tools.insert")}
          >
            <LayoutGrid />
          </Button>
        </InsertPicker>
        <ToolButton
          label={t("canvases.tools.section")}
          shortcut="F"
          pressed={tool === "frame"}
          onClick={() => onTool("frame")}
        >
          <Frame />
        </ToolButton>
        <ToolButton label={`${t("canvases.tools.images")} (${soon})`} disabled>
          <ImagePlus />
        </ToolButton>
      </div>
    </div>
  );
}

/** Excalidraw's keys for its shapes (the cloud and the bubble have none). */
const SHAPE_KEYS: Partial<Record<Shape, string>> = {
  arrow: "A",
  line: "L",
  rectangle: "R",
  ellipse: "O",
  diamond: "D",
};
