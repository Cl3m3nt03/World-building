import { useStore, ViewportPortal } from "@xyflow/react";
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TreeAnnotation } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { annotationColor, type Drawing, type FreeText, strokePath } from "../annotations";

export type Tool = "select" | "pan" | "draw" | "erase" | "text";

/** Arrows move a focused annotation this far, in tree units. */
const KEY_STEP = 8;

type Props = {
  annotations: TreeAnnotation[];
  tool: Tool;
  /** The stroke being drawn (tree coordinates), shown in `draftStyle`. */
  draft: { points: [number, number][]; color: string; width: number } | null;
  selectedId: string | null;
  editingId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (id: string | null) => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onRemove: (id: string) => void;
  onText: (id: string, text: string) => void;
};

/**
 * Strokes and texts drawn over a tree (docs/features/05-relation-tree.md),
 * in the tree's coordinates (they follow pan and zoom). With the select
 * tool, one is selected by a click (or Tab), moved by dragging (or the
 * arrows) and removed with Delete; a text is edited by a double click (or
 * Enter). With the eraser, a click removes one.
 */
export function AnnotationLayer({
  annotations,
  tool,
  draft,
  selectedId,
  editingId,
  onSelect,
  onEdit,
  onMove,
  onRemove,
  onText,
}: Props) {
  const { t } = useTranslation();
  const zoom = useStore((state) => state.transform[2]);
  // An annotation being dragged: how far it has gone (tree units).
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const active = tool === "select" || tool === "erase";

  const onPointerDown = (event: PointerEvent, id: string) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (tool === "erase") {
      onRemove(id);
      return;
    }
    if (tool !== "select" || editingId === id) return;
    onSelect(id);
    start.current = { x: event.clientX, y: event.clientY };
    setDragging({ id, dx: 0, dy: 0 });
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!dragging || !start.current) return;
    setDragging({
      id: dragging.id,
      dx: (event.clientX - start.current.x) / zoom,
      dy: (event.clientY - start.current.y) / zoom,
    });
  };
  const onPointerUp = () => {
    if (dragging && (dragging.dx !== 0 || dragging.dy !== 0)) {
      onMove(dragging.id, dragging.dx, dragging.dy);
    }
    setDragging(null);
    start.current = null;
  };

  const onKeyDown = (event: KeyboardEvent, annotation: TreeAnnotation) => {
    if (editingId === annotation.id) return;
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const step = steps[event.key];
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onRemove(annotation.id);
    } else if (event.key === "Enter" && annotation.kind === "text") {
      event.preventDefault();
      onEdit(annotation.id);
    } else if (step) {
      event.preventDefault();
      onMove(annotation.id, step[0], step[1]);
    } else return;
    event.stopPropagation();
  };

  const offset = (id: string) =>
    dragging?.id === id ? `translate(${dragging.dx}px, ${dragging.dy}px)` : undefined;
  const drawings = annotations.filter((a): a is Drawing => a.kind === "drawing");
  const texts = annotations.filter((a): a is FreeText => a.kind === "text");

  return (
    <ViewportPortal>
      <svg
        className="bz-tree-annotations absolute top-0 left-0 overflow-visible"
        width={1}
        height={1}
      >
        <title>{t("trees.annotations.layer")}</title>
        {drawings.map((drawing, index) => {
          const d = strokePath(drawing.points);
          const width = drawing.width ?? 4;
          const selected = selectedId === drawing.id;
          return (
            // biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be a button
            <g
              key={drawing.id}
              role="button"
              tabIndex={active ? 0 : -1}
              aria-label={t("trees.annotations.drawing", { n: index + 1 })}
              aria-pressed={selected}
              className={cn("nodrag nopan outline-none", active && "cursor-pointer")}
              style={{ transform: offset(drawing.id) }}
              onPointerDown={(event) => onPointerDown(event, drawing.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onFocus={() => tool === "select" && onSelect(drawing.id)}
              onKeyDown={(event) => onKeyDown(event, drawing)}
            >
              {selected && (
                <path
                  d={d}
                  fill="none"
                  stroke="var(--primary)"
                  strokeOpacity={0.35}
                  strokeWidth={width + 8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              <path
                d={d}
                fill="none"
                stroke={annotationColor(drawing.color)}
                strokeWidth={width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* A wider invisible line, easier to point at. */}
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={width + 14}
                strokeLinecap="round"
                style={{ pointerEvents: active ? "stroke" : "none" }}
              />
            </g>
          );
        })}
        {draft && draft.points.length > 0 && (
          <path
            d={strokePath(
              draft.points.length === 1
                ? [draft.points[0] ?? [0, 0], draft.points[0] ?? [0, 0]]
                : draft.points,
            )}
            fill="none"
            stroke={annotationColor(draft.color)}
            strokeWidth={draft.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      {texts.map((text) =>
        editingId === text.id ? (
          <TextEditor key={text.id} text={text} onDone={(value) => onText(text.id, value)} />
        ) : (
          <button
            type="button"
            key={text.id}
            tabIndex={active ? 0 : -1}
            aria-label={t("trees.annotations.text", { text: text.text })}
            aria-pressed={selectedId === text.id}
            className={cn(
              "nodrag nopan absolute rounded-sm px-1 leading-tight font-medium whitespace-pre outline-none",
              active ? "pointer-events-auto cursor-pointer" : "pointer-events-none",
              selectedId === text.id && "ring-2 ring-primary/60",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
            style={{
              left: text.x ?? 0,
              top: text.y ?? 0,
              fontSize: text.size ?? 20,
              color: annotationColor(text.color),
              transform: offset(text.id),
            }}
            onPointerDown={(event) => onPointerDown(event, text.id)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDoubleClick={() => tool === "select" && onEdit(text.id)}
            onFocus={() => tool === "select" && onSelect(text.id)}
            onKeyDown={(event) => onKeyDown(event, text)}
          >
            {text.text}
          </button>
        ),
      )}
    </ViewportPortal>
  );
}

/** A text being written: Enter or leaving keeps it (empty: it goes), Escape too. */
function TextEditor({ text, onDone }: { text: FreeText; onDone: (value: string) => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(text.text);
  const done = useRef(false);
  const finish = (next: string) => {
    if (done.current) return;
    done.current = true;
    onDone(next);
  };
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  return (
    <input
      ref={input}
      aria-label={t("trees.annotations.textField")}
      className="nodrag nopan pointer-events-auto absolute min-w-40 rounded-sm border border-primary bg-background/80 px-1 leading-tight font-medium outline-none"
      style={{
        left: text.x ?? 0,
        top: text.y ?? 0,
        fontSize: text.size ?? 20,
        color: annotationColor(text.color),
      }}
      value={value}
      maxLength={1000}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter" || event.key === "Escape") {
          event.preventDefault();
          finish(value);
        }
      }}
    />
  );
}
