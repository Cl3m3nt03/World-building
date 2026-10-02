import {
  type Active,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  KeyboardSensor,
  type Over,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  type SortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Columns2,
  GripVertical,
  ImageIcon,
  Map as MapIcon,
  MoreHorizontal,
  Plus,
  Rows2,
  Swords,
  Trash2,
  Type,
} from "lucide-react";
import {
  type CSSProperties,
  Fragment,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TemplateSection } from "@/lib/bindings";
import { usePendingSave } from "@/lib/pendingSaves";
import { ImageBlockView } from "./ImageBlockView";
import {
  leaveRow,
  MAX_ROW_BLOCKS,
  MIN_WIDTH,
  moveInRow,
  moveRow,
  moveToRow,
  normalize,
  placeBeside,
  resize,
  rowOf,
  rows,
  WIDTH_STEP,
} from "./layout";
import { MapBlockView } from "./MapBlockView";
import { type Block, type BlockType, newBlock } from "./model";
import { Stats5eBlockView } from "./stats/Stats5eBlockView";
import { TextBlockEditor } from "./TextBlockEditor";
import { templateBlocks } from "./template";
import { useCardContent, useSaveCardContent } from "./useCardContent";

/** Delay before changes are saved. */
const SAVE_DELAY_MS = 600;

/** Block types offered by "+" and "/". */
const BLOCK_CHOICES: {
  type: BlockType;
  icon: typeof Type;
  label: "blocks.types.text" | "blocks.types.image" | "blocks.types.stats5e" | "blocks.types.map";
}[] = [
  { type: "text", icon: Type, label: "blocks.types.text" },
  { type: "image", icon: ImageIcon, label: "blocks.types.image" },
  { type: "map", icon: MapIcon, label: "blocks.types.map" },
  { type: "stats5e", icon: Swords, label: "blocks.types.stats5e" },
];

/** While a block is dropped beside another, the others do not make room. */
const stayInPlace: SortingStrategy = () => null;

/** Share of a block's width, on each side, where a dropped block goes beside it. */
const SIDE_ZONE = 0.25;

/** Where a dragged block would land, shown on the block under it. */
type DropHint = "left" | "right" | "before" | "after";

const BLOCK_LABELS = {
  text: "blocks.textLabel",
  image: "blocks.imageLabel",
  stats5e: "blocks.stats5eLabel",
  map: "blocks.mapLabel",
} as const satisfies Record<BlockType, string>;

/** Menu of block types; `children` is the trigger, or the menu is controlled. */
function BlockTypeMenu({
  onPick,
  open,
  onOpenChange,
  onCloseAutoFocus,
  children,
}: {
  onPick: (type: BlockType) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Where the focus goes when the menu closes (default: back to its trigger). */
  onCloseAutoFocus?: (event: Event) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange === undefined ? {} : { onOpenChange })}
    >
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-56"
        {...(onCloseAutoFocus === undefined ? {} : { onCloseAutoFocus })}
      >
        <DropdownMenuLabel>{t("blocks.insert")}</DropdownMenuLabel>
        {BLOCK_CHOICES.map(({ type, icon: Icon, label }) => (
          <DropdownMenuItem key={type} onSelect={() => onPick(type)}>
            <Icon />
            {t(label)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The border between two blocks of a line: dragged with the pointer, or
 * moved with ← → (10 % at a time), it shares their width. Hidden when the
 * window is too narrow for blocks side by side.
 */
function ColumnResizer({
  width,
  label,
  onResize,
  snapshot,
  onEnd,
}: {
  /** Width of the block on its left, as a share of the line. */
  width: number;
  label: string;
  /** Moves the border by `delta`; while dragging, from the blocks at the start. */
  onResize: (delta: number, from?: Block[]) => void;
  snapshot: () => Block[];
  onEnd: () => void;
}) {
  const start = useRef<{ x: number; lineWidth: number; blocks: Block[] } | null>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -WIDTH_STEP, ArrowRight: WIDTH_STEP }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    onResize(step);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const line = event.currentTarget.parentElement;
    if (!line) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, lineWidth: line.clientWidth, blocks: snapshot() };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const from = start.current;
    if (!from || from.lineWidth === 0) return;
    onResize((event.clientX - from.x) / from.lineWidth, from.blocks);
  };
  const onPointerUp = () => {
    if (!start.current) return;
    start.current = null;
    onEnd();
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: an <hr> cannot take the focus and the arrow keys
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={MIN_WIDTH * 100}
      aria-valuemax={100 - MIN_WIDTH * 100}
      aria-valuenow={Math.round(width * 100)}
      onKeyDown={onKeyDown}
      onKeyUp={onEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="group/resizer hidden w-3 shrink-0 cursor-col-resize touch-none justify-center outline-none @min-[40rem]:flex"
    >
      <span className="h-full w-0.5 rounded-full bg-transparent transition group-hover/resizer:bg-border group-focus-visible/resizer:bg-ring" />
    </div>
  );
}

/** What the block menu can do with the block's place (lines of blocks, 3.11). */
type PlaceActions = {
  /** The block's line can go up / down. */
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveRow: (step: -1 | 1) => void;
  /** The block shares a line: its position on it, and the line's size. */
  column: { index: number; count: number } | null;
  onMoveInRow: (step: -1 | 1) => void;
  onLeaveRow: () => void;
  /** The line above has room: the block can go beside its last block. */
  canJoinPrevious: boolean;
  onJoinPrevious: () => void;
};

function SortableBlock({
  cardId,
  block,
  index,
  focus,
  hint,
  style,
  place,
  onChange,
  onInsertAfter,
  onDelete,
}: {
  cardId: string;
  block: Block;
  index: number;
  focus: boolean;
  /** Where a dragged block would land, relative to this one. */
  hint: DropHint | null;
  /** The column's width on a line. */
  style: CSSProperties | undefined;
  place: PlaceActions;
  onChange: (block: Block) => void;
  onInsertAfter: (type: BlockType) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [slashOpen, setSlashOpen] = useState(false);
  const removeSlashLine = useRef<(() => void) | null>(null);
  const refocusSlashLine = useRef<(() => void) | null>(null);
  const picked = useRef(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });
  const label = t(BLOCK_LABELS[block.type], { index: index + 1 });

  return (
    <div
      ref={setNodeRef}
      data-block={block.id}
      style={{ ...style, transform: CSS.Transform.toString(transform), transition }}
      className={`group relative flex min-w-0 items-start gap-1 rounded-lg @min-[40rem]:[flex:var(--column)_1_0%] ${isDragging ? "z-10 bg-accent opacity-80" : ""}`}
    >
      {hint && (
        <span
          aria-hidden
          className={
            hint === "left" || hint === "right"
              ? `absolute inset-y-0 w-0.5 rounded-full bg-primary ${hint === "left" ? "-left-1.5" : "-right-1.5"}`
              : `absolute inset-x-0 h-0.5 rounded-full bg-primary ${hint === "before" ? "-top-1" : "-bottom-1"}`
          }
        />
      )}
      <div className="flex shrink-0 items-center pt-0.5 opacity-40 transition group-focus-within:opacity-100 group-hover:opacity-100">
        <Button
          ref={setActivatorNodeRef}
          variant="ghost"
          size="icon-xs"
          aria-label={t("blocks.drag", { index: index + 1 })}
          className="cursor-grab"
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("blocks.actions", { index: index + 1 })}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem disabled={!place.canMoveUp} onSelect={() => place.onMoveRow(-1)}>
              <ArrowUp />
              {place.column ? t("blocks.moveRowUp") : t("blocks.moveUp")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!place.canMoveDown} onSelect={() => place.onMoveRow(1)}>
              <ArrowDown />
              {place.column ? t("blocks.moveRowDown") : t("blocks.moveDown")}
            </DropdownMenuItem>
            {place.column ? (
              <>
                <DropdownMenuItem
                  disabled={place.column.index === 0}
                  onSelect={() => place.onMoveInRow(-1)}
                >
                  <ArrowLeft />
                  {t("blocks.moveLeft")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={place.column.index === place.column.count - 1}
                  onSelect={() => place.onMoveInRow(1)}
                >
                  <ArrowRight />
                  {t("blocks.moveRight")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={place.onLeaveRow}>
                  <Rows2 />
                  {t("blocks.leaveRow")}
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem disabled={!place.canJoinPrevious} onSelect={place.onJoinPrevious}>
                <Columns2 />
                {t("blocks.joinPrevious")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 />
              {t("blocks.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="relative min-w-0 flex-1">
        {block.type === "text" ? (
          <TextBlockEditor
            cardId={cardId}
            doc={block.doc}
            label={label}
            autoFocus={focus}
            onChange={(doc) => onChange({ ...block, doc })}
            onSlash={(removeLine, refocus) => {
              removeSlashLine.current = removeLine;
              refocusSlashLine.current = refocus;
              picked.current = false;
              setSlashOpen(true);
            }}
            prompt={block.prompt}
          />
        ) : block.type === "image" ? (
          <ImageBlockView block={block} label={label} pickOnMount={focus} onChange={onChange} />
        ) : block.type === "map" ? (
          <MapBlockView block={block} label={label} onChange={onChange} />
        ) : (
          <Stats5eBlockView block={block} label={label} onChange={onChange} />
        )}
        <BlockTypeMenu
          open={slashOpen}
          onOpenChange={setSlashOpen}
          // The menu's trigger cannot take the focus: closed without a choice
          // (Escape), the focus goes back to the line where "/" was typed; a
          // new block takes it itself.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!picked.current) refocusSlashLine.current?.();
          }}
          onPick={(type) => {
            picked.current = true;
            setSlashOpen(false);
            removeSlashLine.current?.();
            onInsertAfter(type);
          }}
        >
          <span aria-hidden className="absolute bottom-0 left-2 size-0" />
        </BlockTypeMenu>
      </div>
    </div>
  );
}

/**
 * The card's content as blocks: add them with "+" or "/", reorder them by
 * dragging the handle (or with the keyboard: Space on the handle, arrows,
 * Space; or the block menu), delete them. Saved as you type.
 */
export type BlockEditorHandle = {
  /** Appends the guided template's missing sections (nothing is removed). */
  applyTemplate: () => void;
};

export function BlockEditor({
  cardId,
  template = [],
  templateName = "",
  ref,
}: {
  cardId: string;
  /** The guided template of the card's type (see `effectiveTemplate`). */
  template?: TemplateSection[];
  /** Name of the type the template comes from. */
  templateName?: string;
  ref?: Ref<BlockEditorHandle>;
}) {
  const { t } = useTranslation();
  // Said after applying a template (a polite live region reads it).
  const [notice, setNotice] = useState("");
  const content = useCardContent(cardId);
  const save = useSaveCardContent(cardId);
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  /** Whether the "Add a block" menu closed because a type was picked. */
  const addPicked = useRef(false);
  const pending = useRef<Block[] | null>(null);
  // The latest blocks, so that changes made in a row (a line removed, then
  // a block inserted) each apply to the result of the previous one.
  const current = useRef<Block[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // dnd-kit reports a block over its own place right after picking it up:
  // only a change of position is announced, so "picked up" is not cut short.
  const lastOver = useRef<UniqueIdentifier | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (content.data && blocks === null) {
      const loaded = normalize(content.data);
      current.current = loaded;
      setBlocks(loaded);
    }
  }, [content.data, blocks]);

  // The save in progress, awaited before the world closes.
  const saving = useRef<Promise<unknown> | undefined>(undefined);
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current) {
      // A failure is shown under the blocks (`save.error`).
      saving.current = save.mutateAsync(pending.current).catch(() => {});
      pending.current = null;
    }
    return saving.current;
  }, [save.mutateAsync]);

  // Unsaved changes are saved when leaving the card, and before the world
  // or the window closes.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => void flushRef.current(), []);
  usePendingSave(flush);

  // A block dragged over another: where it would land.
  const [drop, setDrop] = useState<{ id: string; hint: DropHint } | null>(null);

  const update = (change: (previous: Block[]) => Block[], immediately = false) => {
    const next = normalize(change(current.current));
    current.current = next;
    setBlocks(next);
    pending.current = next;
    clearTimeout(timer.current);
    if (immediately) flush();
    else timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  const applyTemplate = () => {
    const added = templateBlocks(current.current, template);
    if (added.length === 0) {
      setNotice(t("templates.nothingToAdd"));
      return;
    }
    setNotice(t("templates.added", { count: added.length }));
    const first = added[0];
    if (first) setFocusId(first.id);
    update((previous) => [...previous, ...added], true);
  };
  const applyRef = useRef(applyTemplate);
  applyRef.current = applyTemplate;
  useImperativeHandle(ref, () => ({ applyTemplate: () => applyRef.current() }), []);

  if (content.isError) return <AppErrorMessage error={content.error} />;
  if (!blocks) return null;

  const insert = (index: number, type: BlockType) => {
    const block = newBlock(type);
    setFocusId(block.id);
    update((previous) => [...previous.slice(0, index), block, ...previous.slice(index)], true);
  };
  /** A new block right under the line of the block `id`. */
  const insertAfter = (id: string, type: BlockType) => {
    const last = rowOf(current.current, id)?.row.blocks.at(-1);
    insert(current.current.findIndex((block) => block.id === last?.id) + 1, type);
  };
  const lines = rows(blocks);
  const hasLines = lines.some((line) => line.blocks.length > 1);

  // What screen readers hear while a block is moved (dnd-kit's own texts
  // are in English and name blocks by their id).
  const blockAt = (id: UniqueIdentifier | undefined) => {
    const index = (blocks ?? []).findIndex((block) => block.id === id);
    const block = blocks?.[index];
    return {
      name: block ? t(BLOCK_LABELS[block.type], { index: index + 1 }) : "",
      position: index + 1,
      count: blocks?.length ?? 0,
    };
  };
  const accessibility = {
    screenReaderInstructions: { draggable: t("blocks.dragInstructions") },
    announcements: {
      onDragStart: ({ active }: { active: Active }) => {
        lastOver.current = active.id;
        return t("blocks.dragPicked", blockAt(active.id));
      },
      onDragOver: ({ active, over }: { active: Active; over: Over | null }) => {
        if (!over || over.id === lastOver.current) return undefined;
        lastOver.current = over.id;
        return t("blocks.dragOver", { ...blockAt(over.id), name: blockAt(active.id).name });
      },
      onDragMove: () => undefined,
      onDragEnd: ({ active, over }: { active: Active; over: Over | null }) =>
        t("blocks.dragDropped", {
          ...blockAt(over?.id ?? active.id),
          name: blockAt(active.id).name,
        }),
      onDragCancel: ({ active }: { active: Active }) =>
        t("blocks.dragCancelled", blockAt(active.id)),
    },
  };

  /**
   * With the pointer, a block dragged over the left or right quarter of
   * another goes beside it (unless that line is full); elsewhere it goes
   * before or after the other's whole line.
   */
  const onDragMove = ({ active, over, activatorEvent, delta }: DragMoveEvent) => {
    if (!over || over.id === active.id) return setDrop(null);
    const id = String(over.id);
    const pointer = activatorEvent as Partial<MouseEvent>;
    if (typeof pointer.clientX === "number") {
      const x = pointer.clientX + delta.x;
      const { left, width } = over.rect;
      const side =
        x < left + width * SIDE_ZONE ? "left" : x > left + width * (1 - SIDE_ZONE) ? "right" : null;
      const line = rowOf(current.current, id)?.row.blocks ?? [];
      const room = line.some((block) => block.id === active.id) || line.length < MAX_ROW_BLOCKS;
      if (side && room) return setDrop({ id, hint: side });
    }
    const from = lines.findIndex((line) => line.blocks.some((block) => block.id === active.id));
    const to = lines.findIndex((line) => line.blocks.some((block) => block.id === id));
    setDrop({ id, hint: from < to ? "after" : "before" });
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const hint = drop?.hint;
    setDrop(null);
    if (!over || active.id === over.id) return;
    const id = String(active.id);
    const target = String(over.id);
    update(
      (previous) =>
        hint === "left" || hint === "right"
          ? placeBeside(previous, id, target, hint)
          : moveToRow(previous, id, target),
      true,
    );
  };
  // Without lines, the blocks make room as before; otherwise a line shows
  // where the block would land.
  const sideways = drop?.hint === "left" || drop?.hint === "right";
  const strategy = hasLines || sideways ? stayInPlace : verticalListSortingStrategy;

  const placeActions = (block: Block, lineIndex: number): PlaceActions => {
    const line = lines[lineIndex];
    const above = lines[lineIndex - 1];
    const column = line && line.blocks.length > 1 ? line.blocks.indexOf(block) : -1;
    return {
      canMoveUp: lineIndex > 0,
      canMoveDown: lineIndex < lines.length - 1,
      onMoveRow: (step) => update((previous) => moveRow(previous, block.id, step), true),
      column: line && column >= 0 ? { index: column, count: line.blocks.length } : null,
      onMoveInRow: (step) => update((previous) => moveInRow(previous, block.id, step), true),
      onLeaveRow: () => update((previous) => leaveRow(previous, block.id), true),
      canJoinPrevious: above !== undefined && above.blocks.length < MAX_ROW_BLOCKS,
      onJoinPrevious: () => {
        const last = above?.blocks.at(-1);
        if (last) update((previous) => placeBeside(previous, block.id, last.id, "right"), true);
      },
    };
  };

  return (
    <section aria-label={t("blocks.title")} className="flex flex-col gap-2">
      {blocks.length === 0 ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => insert(0, "text")}
            className="rounded-lg border border-dashed border-border px-3 py-4 text-left text-sm text-muted-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("blocks.empty")}
          </button>
          {template.length > 0 && (
            <button
              type="button"
              onClick={applyTemplate}
              className="flex flex-col gap-0.5 rounded-lg border border-dashed border-primary/50 px-3 py-3 text-left text-sm outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span>{t("templates.use", { type: templateName })}</span>
              <span className="text-xs text-muted-foreground">
                {template.map((section) => section.title).join(" · ")}
              </span>
            </button>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDrop(null)}
          accessibility={accessibility}
        >
          <SortableContext items={blocks.map((block) => block.id)} strategy={strategy}>
            <ul className="@container flex flex-col gap-1">
              {lines.map((line, lineIndex) => (
                <li
                  key={line.blocks[0]?.id}
                  className={
                    line.blocks.length > 1
                      ? "flex flex-col gap-1 @min-[40rem]:flex-row @min-[40rem]:gap-0"
                      : undefined
                  }
                >
                  {line.blocks.map((block, column) => {
                    const index = blocks.indexOf(block);
                    const next = line.blocks[column + 1];
                    return (
                      <Fragment key={block.id}>
                        <SortableBlock
                          cardId={cardId}
                          block={block}
                          index={index}
                          focus={block.id === focusId}
                          hint={drop?.id === block.id ? drop.hint : null}
                          style={
                            line.blocks.length > 1
                              ? ({ "--column": block.width ?? 1 } as CSSProperties)
                              : undefined
                          }
                          place={placeActions(block, lineIndex)}
                          onChange={(changed) =>
                            update((previous) =>
                              previous.map((other) => (other.id === changed.id ? changed : other)),
                            )
                          }
                          onInsertAfter={(type) => insertAfter(block.id, type)}
                          onDelete={() =>
                            update(
                              (previous) => previous.filter((other) => other.id !== block.id),
                              true,
                            )
                          }
                        />
                        {next && (
                          <ColumnResizer
                            width={block.width ?? 0.5}
                            label={t("blocks.columnWidth", { index: index + 1 })}
                            onResize={(delta, from) =>
                              update((previous) => resize(from ?? previous, block.id, delta))
                            }
                            snapshot={() => current.current}
                            onEnd={flush}
                          />
                        )}
                      </Fragment>
                    );
                  })}
                </li>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <p aria-live="polite" className="text-xs text-muted-foreground empty:hidden">
        {notice}
      </p>
      {save.isError && <AppErrorMessage error={save.error} />}
      <BlockTypeMenu
        // A new block takes the focus itself; closed without a choice
        // (Escape), the focus goes back to the button.
        onCloseAutoFocus={(event) => {
          if (addPicked.current) event.preventDefault();
          addPicked.current = false;
        }}
        onPick={(type) => {
          addPicked.current = true;
          insert(blocks.length, type);
        }}
      >
        <Button variant="ghost" size="sm" className="self-start">
          <Plus />
          {t("blocks.add")}
        </Button>
      </BlockTypeMenu>
    </section>
  );
}
