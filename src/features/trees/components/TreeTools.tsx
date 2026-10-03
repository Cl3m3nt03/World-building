import {
  Eraser,
  Hand,
  Maximize,
  MousePointer2,
  Pencil,
  Trash2,
  Type,
  UserRoundPlus,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ChoiceTiles } from "@/features/card-types";
import type { TranslationKey } from "@/i18n";
import type { TreeAnnotation } from "@/lib/bindings";
import {
  ANNOTATION_COLORS,
  annotationColor,
  annotationColorLabel,
  PEN_WIDTHS,
  TEXT_SIZES,
} from "../annotations";
import type { Tool } from "./AnnotationLayer";

export type PenStyle = { color: string; width: number };
export type TextStyle = { color: string; size: number };

const TOOLS: { tool: Tool; icon: typeof Pencil; label: TranslationKey }[] = [
  { tool: "select", icon: MousePointer2, label: "trees.tools.select" },
  { tool: "pan", icon: Hand, label: "trees.tools.pan" },
  { tool: "draw", icon: Pencil, label: "trees.tools.draw" },
  { tool: "text", icon: Type, label: "trees.tools.text" },
];

type Props = {
  tool: Tool;
  onTool: (tool: Tool) => void;
  pen: PenStyle;
  onPen: (pen: PenStyle) => void;
  text: TextStyle;
  onText: (text: TextStyle) => void;
  /** The annotation selected with the select tool: its own colour and size. */
  selected: TreeAnnotation | undefined;
  onSelectedStyle: (patch: { color?: string; size?: number; width?: number }) => void;
  onSelectedRemove: () => void;
  onAddNode: () => void;
  onRecenter: () => void;
  /** More tools (the variants). */
  children?: ReactNode;
};

/** Colour swatches: a radio group, one tab stop. */
function Colors({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <ChoiceTiles
      label={label}
      value={value}
      onChange={onChange}
      className="flex-nowrap gap-1"
      tileClassName="size-6 rounded-full"
      choices={ANNOTATION_COLORS.map((color) => ({
        value: color,
        label: t(annotationColorLabel(color)),
        content: (
          <span
            aria-hidden
            className="size-4 rounded-full border border-border"
            style={{ background: annotationColor(color) }}
          />
        ),
      }))}
    />
  );
}

/** Pen widths or text sizes, drawn as dots or letters. */
function Sizes({
  sizes,
  value,
  onChange,
  label,
  kind,
}: {
  sizes: readonly number[];
  value: number;
  onChange: (size: number) => void;
  label: string;
  kind: "width" | "size";
}) {
  const { t } = useTranslation();
  return (
    <ChoiceTiles
      label={label}
      value={String(value)}
      onChange={(next) => onChange(Number(next))}
      className="flex-nowrap gap-1"
      tileClassName="size-7"
      choices={sizes.map((size) => ({
        value: String(size),
        label: t(
          kind === "width" ? "trees.annotations.widthValue" : "trees.annotations.sizeValue",
          {
            size,
          },
        ),
        content:
          kind === "width" ? (
            <span
              aria-hidden
              className="rounded-full bg-current"
              style={{ width: Math.min(size + 2, 16), height: Math.min(size + 2, 16) }}
            />
          ) : (
            <Type aria-hidden style={{ width: 8 + size / 2, height: 8 + size / 2 }} />
          ),
      }))}
    />
  );
}

/**
 * The tools floating at the bottom of a tree (as on the board): add a node,
 * select, pan, draw, write, then more (variants) and recenter. Above them,
 * the drawing or writing options, or those of the selected annotation.
 */
export function TreeTools({
  tool,
  onTool,
  pen,
  onPen,
  text,
  onText,
  selected,
  onSelectedStyle,
  onSelectedRemove,
  onAddNode,
  onRecenter,
  children,
}: Props) {
  const { t } = useTranslation();
  const drawing = tool === "draw" || tool === "erase";
  const options = drawing ? (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-pressed={tool === "draw"}
        aria-label={t("trees.tools.pen")}
        title={t("trees.tools.pen")}
        onClick={() => onTool("draw")}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-pressed={tool === "erase"}
        aria-label={t("trees.tools.eraser")}
        title={t("trees.tools.eraser")}
        onClick={() => onTool("erase")}
      >
        <Eraser />
      </Button>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Sizes
        sizes={PEN_WIDTHS}
        value={pen.width}
        onChange={(width) => onPen({ ...pen, width })}
        label={t("trees.annotations.width")}
        kind="width"
      />
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Colors
        value={pen.color}
        onChange={(color) => onPen({ ...pen, color })}
        label={t("trees.annotations.color")}
      />
    </>
  ) : tool === "text" ? (
    <>
      <Sizes
        sizes={TEXT_SIZES}
        value={text.size}
        onChange={(size) => onText({ ...text, size })}
        label={t("trees.annotations.size")}
        kind="size"
      />
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Colors
        value={text.color}
        onChange={(color) => onText({ ...text, color })}
        label={t("trees.annotations.color")}
      />
    </>
  ) : tool === "select" && selected ? (
    <>
      {selected.kind === "drawing" ? (
        <Sizes
          sizes={PEN_WIDTHS}
          value={selected.width ?? 4}
          onChange={(width) => onSelectedStyle({ width })}
          label={t("trees.annotations.width")}
          kind="width"
        />
      ) : (
        <Sizes
          sizes={TEXT_SIZES}
          value={selected.size ?? 20}
          onChange={(size) => onSelectedStyle({ size })}
          label={t("trees.annotations.size")}
          kind="size"
        />
      )}
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Colors
        value={selected.color}
        onChange={(color) => onSelectedStyle({ color })}
        label={t("trees.annotations.color")}
      />
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("trees.annotations.remove")}
        title={t("trees.annotations.remove")}
        className="text-destructive"
        onClick={onSelectedRemove}
      >
        <Trash2 />
      </Button>
    </>
  ) : null;

  return (
    <div className="nodrag nopan absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
      {options && (
        <div
          role="toolbar"
          aria-label={t(
            drawing
              ? "trees.tools.drawOptions"
              : tool === "text"
                ? "trees.tools.textOptions"
                : "trees.tools.annotationOptions",
          )}
          className="glass flex items-center gap-1 rounded-lg border border-border p-1 shadow-sm"
        >
          {options}
        </div>
      )}
      <div
        role="toolbar"
        aria-label={t("trees.toolbar")}
        className="glass flex items-center gap-1 rounded-lg border border-border p-1 shadow-sm"
      >
        <Button variant="ghost" size="sm" onClick={onAddNode}>
          <UserRoundPlus />
          {t("trees.nodes.add")}
        </Button>
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        {TOOLS.map(({ tool: value, icon: Icon, label }) => (
          <Button
            key={value}
            variant="ghost"
            size="icon-sm"
            aria-pressed={tool === value || (value === "draw" && tool === "erase")}
            aria-label={t(label)}
            title={t(label)}
            className="aria-pressed:bg-secondary aria-pressed:text-foreground"
            onClick={() => onTool(value)}
          >
            <Icon />
          </Button>
        ))}
        {children}
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        <Button variant="ghost" size="sm" onClick={onRecenter}>
          <Maximize />
          {t("trees.recenter")}
        </Button>
      </div>
    </div>
  );
}
