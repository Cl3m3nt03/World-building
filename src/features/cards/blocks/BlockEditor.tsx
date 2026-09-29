import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  ImageIcon,
  Map as MapIcon,
  MoreHorizontal,
  Plus,
  Swords,
  Trash2,
  Type,
} from "lucide-react";
import {
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
import { type Block, type BlockType, move, newBlock } from "./model";
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
  label: "blocks.types.text" | "blocks.types.image" | "blocks.types.stats5e";
}[] = [
  { type: "text", icon: Type, label: "blocks.types.text" },
  { type: "image", icon: ImageIcon, label: "blocks.types.image" },
  { type: "stats5e", icon: Swords, label: "blocks.types.stats5e" },
];

const BLOCK_LABELS = {
  text: "blocks.textLabel",
  image: "blocks.imageLabel",
  stats5e: "blocks.stats5eLabel",
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
        {/* Maps come with M4: shown, but not available yet. */}
        <DropdownMenuItem disabled>
          <MapIcon />
          {t("blocks.types.map")}
          <span className="ml-auto text-xs">{t("placeholder.comingIn", { milestone: "M4" })}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortableBlock({
  cardId,
  block,
  index,
  count,
  focus,
  onChange,
  onInsertAfter,
  onMove,
  onDelete,
}: {
  cardId: string;
  block: Block;
  index: number;
  count: number;
  focus: boolean;
  onChange: (block: Block) => void;
  onInsertAfter: (type: BlockType) => void;
  onMove: (to: number) => void;
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
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-start gap-1 rounded-lg ${isDragging ? "z-10 bg-accent opacity-80" : ""}`}
    >
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
            <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(index - 1)}>
              <ArrowUp />
              {t("blocks.moveUp")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === count - 1} onSelect={() => onMove(index + 1)}>
              <ArrowDown />
              {t("blocks.moveDown")}
            </DropdownMenuItem>
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
    </li>
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
  const pending = useRef<Block[] | null>(null);
  // The latest blocks, so that changes made in a row (a line removed, then
  // a block inserted) each apply to the result of the previous one.
  const current = useRef<Block[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (content.data && blocks === null) {
      current.current = content.data;
      setBlocks(content.data);
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

  const update = (change: (previous: Block[]) => Block[], immediately = false) => {
    const next = change(current.current);
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

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    update((previous) => {
      const from = previous.findIndex((block) => block.id === active.id);
      const to = previous.findIndex((block) => block.id === over.id);
      return move(previous, from, to);
    }, true);
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={blocks.map((block) => block.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-1">
              {blocks.map((block, index) => (
                <SortableBlock
                  key={block.id}
                  cardId={cardId}
                  block={block}
                  index={index}
                  count={blocks.length}
                  focus={block.id === focusId}
                  onChange={(changed) =>
                    update((previous) =>
                      previous.map((other) => (other.id === changed.id ? changed : other)),
                    )
                  }
                  onInsertAfter={(type) => insert(index + 1, type)}
                  onMove={(to) =>
                    update((previous) => {
                      const from = previous.findIndex((other) => other.id === block.id);
                      return move(previous, from, from + (to - index));
                    }, true)
                  }
                  onDelete={() =>
                    update((previous) => previous.filter((other) => other.id !== block.id), true)
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <p aria-live="polite" className="text-xs text-muted-foreground empty:hidden">
        {notice}
      </p>
      {save.isError && <AppErrorMessage error={save.error} />}
      <BlockTypeMenu onPick={(type) => insert(blocks.length, type)}>
        <Button variant="ghost" size="sm" className="self-start">
          <Plus />
          {t("blocks.add")}
        </Button>
      </BlockTypeMenu>
    </section>
  );
}
