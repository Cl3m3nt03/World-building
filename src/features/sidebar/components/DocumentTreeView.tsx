import {
  DndContext,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useNavigate, useParams } from "@tanstack/react-router";
import { defaultRangeExtractor, type Range, useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight, Folder, FolderOpen, type LucideIcon } from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import type { CardType, DocumentTree } from "@/lib/bindings";
import { useMoveInTree } from "../hooks/useDocumentTree";
import {
  ancestorKeys,
  buildTree,
  type DropPosition,
  documentKey,
  dropMove,
  type Move,
  type TreeNode,
  type TreeRow,
  visibleRows,
} from "../tree";

/** Height of a row, in pixels: fixed, so thousands of rows scroll without measuring. */
const ROW_HEIGHT = 32;
/** Indentation per level, in pixels. */
const INDENT = 16;
/** Hovering a closed folder or parent this long while dragging opens it. */
const OPEN_ON_HOVER_MS = 700;

/** Where a drag would land: the row under the pointer, and the move it makes. */
type Drop = { key: string; position: DropPosition; move: Move | "refused" | null };

type Props = {
  tree: DocumentTree;
  /** The document open in the workspace, if any. */
  currentId: string | null;
};

/**
 * The sidebar's folders and documents as a tree (WAI-ARIA tree pattern):
 * one tab stop, arrows to move, Right / Left to open, close or go to the
 * parent, Home / End, Enter to open a document or a folder. Only the rows in
 * view are in the page, so a world of thousands of cards stays smooth.
 *
 * Rows are dragged with the pointer: the top or bottom quarter of a row puts
 * the dragged one before or after it, the middle puts it inside (into a
 * folder, or under a document as its child). A drop that would put an item
 * into itself, or a folder under a document, is shown refused.
 *
 * Which folders are open is kept for the session; per world in step 3.9.
 */
export function DocumentTreeView({ tree, currentId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const types = useCardTypes();

  const roots = useMemo(() => buildTree(tree), [tree]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const rows = useMemo(() => visibleRows(roots, expanded), [roots, expanded]);
  const indexOf = useMemo(() => new Map(rows.map((row, index) => [row.node.key, index])), [rows]);
  const nodeOf = useMemo(() => new Map(rows.map((row) => [row.node.key, row.node])), [rows]);
  const typesById = useMemo(
    () => new Map((types.data ?? []).map((type) => [type.id, type])),
    [types.data],
  );

  const currentKey = currentId ? documentKey(currentId) : null;
  // The row holding the tab stop; falls back to the open document, then the first row.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const tabStop =
    (activeKey !== null && indexOf.has(activeKey) && activeKey) ||
    (currentKey !== null && indexOf.has(currentKey) && currentKey) ||
    rows[0]?.node.key ||
    null;
  const tabStopIndex = tabStop === null ? -1 : (indexOf.get(tabStop) ?? -1);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const dragIndex = dragKey === null ? -1 : (indexOf.get(dragKey) ?? -1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (index) => rows[index]?.node.key ?? index,
    // The tab stop stays in the page even when scrolled away, so Tab can
    // always come back into the tree; so does a dragged row.
    rangeExtractor: useCallback(
      (range: Range) => {
        const indexes = defaultRangeExtractor(range);
        for (const kept of [tabStopIndex, dragIndex]) {
          if (kept >= 0 && !indexes.includes(kept)) indexes.push(kept);
        }
        return indexes.sort((a, b) => a - b);
      },
      [tabStopIndex, dragIndex],
    ),
  });

  // Opening a document (from the sidebar, a link, the search…) opens the
  // folders and parents around it and brings its row into view.
  const ancestorsOfCurrent = useMemo(
    () => (currentId ? ancestorKeys(tree, currentId) : []),
    [tree, currentId],
  );
  const revealed = useRef<string | null>(null);
  useEffect(() => {
    // Once per opened document: closing a folder around it afterwards stays closed.
    if (!currentKey || revealed.current === currentKey) return;
    const closed = ancestorsOfCurrent.filter((key) => !expanded.has(key));
    if (closed.length > 0) {
      setExpanded((previous) => new Set([...previous, ...closed]));
      return;
    }
    const index = indexOf.get(currentKey);
    // A document just created shows up when the tree is next fetched.
    if (index === undefined) return;
    revealed.current = currentKey;
    setActiveKey(currentKey);
    virtualizer.scrollToIndex(index, { align: "auto" });
  }, [currentKey, ancestorsOfCurrent, expanded, indexOf, virtualizer]);

  // Moving with the keyboard focuses the new row once it is rendered.
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    const key = pendingFocus.current;
    if (key === null) return;
    const element = rowElement(key);
    if (element) {
      pendingFocus.current = null;
      element.focus({ preventScroll: true });
    }
  });

  function rowElement(key: string) {
    return scrollRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
  }

  const moveTo = (index: number) => {
    const row = rows[index];
    if (!row) return;
    pendingFocus.current = row.node.key;
    setActiveKey(row.node.key);
    virtualizer.scrollToIndex(index, { align: "auto" });
  };

  const setOpen = useCallback(
    (key: string, open: boolean) =>
      setExpanded((previous) => {
        if (previous.has(key) === open) return previous;
        const next = new Set(previous);
        if (open) next.add(key);
        else next.delete(key);
        return next;
      }),
    [],
  );

  const activate = (row: TreeRow) => {
    setActiveKey(row.node.key);
    if (row.node.kind === "document") {
      revealed.current = row.node.key;
      void navigate({
        to: "/world/$worldId/world/card/$cardId",
        params: { worldId, cardId: row.node.document.id },
      });
    } else if (row.node.children.length > 0) {
      setOpen(row.node.key, !expanded.has(row.node.key));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, index: number) => {
    const row = rows[index];
    if (!row) return;
    const hasChildren = row.node.children.length > 0;
    const isOpen = expanded.has(row.node.key);
    switch (event.key) {
      case "ArrowDown":
        moveTo(Math.min(index + 1, rows.length - 1));
        break;
      case "ArrowUp":
        moveTo(Math.max(index - 1, 0));
        break;
      case "Home":
        moveTo(0);
        break;
      case "End":
        moveTo(rows.length - 1);
        break;
      case "ArrowRight":
        if (hasChildren && !isOpen) setOpen(row.node.key, true);
        else if (hasChildren) moveTo(index + 1);
        break;
      case "ArrowLeft":
        if (hasChildren && isOpen) setOpen(row.node.key, false);
        else if (row.parentKey !== null) moveTo(indexOf.get(row.parentKey) ?? index);
        break;
      case "Enter":
      case " ":
        activate(row);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  // --- Drag and drop -----------------------------------------------------------

  const move = useMoveInTree();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [drop, setDrop] = useState<Drop | null>(null);
  const pointerY = useRef(0);
  const hoverTimer = useRef<{ key: string; timer: number } | null>(null);
  // The click that ends a drag must not open the dropped row.
  const justDropped = useRef(false);
  const labelOf = (id: string | number | undefined) => {
    const node = typeof id === "string" ? nodeOf.get(id) : undefined;
    return node ? nodeLabel(node) : "";
  };

  useEffect(() => {
    if (dragKey === null) return;
    const track = (event: PointerEvent) => {
      pointerY.current = event.clientY;
    };
    window.addEventListener("pointermove", track);
    return () => window.removeEventListener("pointermove", track);
  }, [dragKey]);

  const clearHover = useCallback(() => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current.timer);
    hoverTimer.current = null;
  }, []);
  useEffect(() => clearHover, [clearHover]);

  const onDragStart = (event: DragStartEvent) => {
    const key = String(event.active.id);
    setDragKey(key);
    setActiveKey(key);
    move.reset();
    const start = event.activatorEvent;
    if (start instanceof PointerEvent || start instanceof globalThis.MouseEvent) {
      pointerY.current = start.clientY;
    }
  };

  const onDragMove = (event: DragMoveEvent) => {
    const overKey = event.over ? String(event.over.id) : null;
    const element = overKey ? rowElement(overKey) : null;
    if (!overKey || !element || dragKey === null) {
      setDrop(null);
      clearHover();
      return;
    }
    const rect = element.getBoundingClientRect();
    const ratio = (pointerY.current - rect.top) / rect.height;
    const position: DropPosition = ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
    setDrop((previous) =>
      previous?.key === overKey && previous.position === position
        ? previous
        : { key: overKey, position, move: dropMove(roots, dragKey, overKey, position) },
    );

    const node = nodeOf.get(overKey);
    const opensOnHover =
      position === "inside" &&
      node !== undefined &&
      node.children.length > 0 &&
      !expanded.has(overKey) &&
      overKey !== dragKey;
    if (!opensOnHover) {
      clearHover();
    } else if (hoverTimer.current?.key !== overKey) {
      clearHover();
      hoverTimer.current = {
        key: overKey,
        timer: window.setTimeout(() => setOpen(overKey, true), OPEN_ON_HOVER_MS),
      };
    }
  };

  const endDrag = () => {
    setDragKey(null);
    setDrop(null);
    clearHover();
  };

  const onDragEnd = () => {
    justDropped.current = true;
    window.setTimeout(() => {
      justDropped.current = false;
    }, 0);
    if (drop?.move && drop.move !== "refused") {
      // Filed inside: open it, so the dropped row stays in sight.
      if (drop.position === "inside") setOpen(drop.key, true);
      move.mutate(drop.move);
    }
    endDrag();
  };

  const dragged = dragKey ? nodeOf.get(dragKey) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
      accessibility={{
        screenReaderInstructions: { draggable: t("sidebar.drag.instructions") },
        announcements: {
          onDragStart: ({ active }) => t("sidebar.drag.picked", { name: labelOf(active.id) }),
          onDragOver: ({ over }) =>
            over ? t("sidebar.drag.over", { target: labelOf(over.id) }) : undefined,
          onDragMove: () => undefined,
          onDragEnd: ({ active }) => t("sidebar.drag.dropped", { name: labelOf(active.id) }),
          onDragCancel: ({ active }) => t("sidebar.drag.cancelled", { name: labelOf(active.id) }),
        },
      }}
    >
      {move.error && (
        <div className="px-2 pt-2">
          <AppErrorMessage error={move.error} />
        </div>
      )}
      <div
        ref={scrollRef}
        role="tree"
        aria-label={t("sidebar.tree")}
        data-tree-viewport=""
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2"
      >
        <div role="none" className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            const { node } = row;
            const isOpen = node.children.length > 0 && expanded.has(node.key);
            const indicator =
              drop?.key === node.key && drop.move !== null
                ? drop.move === "refused"
                  ? "refused"
                  : drop.position
                : undefined;
            return (
              <TreeItem
                key={item.key}
                row={row}
                top={item.start}
                isOpen={isOpen}
                isCurrent={node.key === currentKey}
                isTabStop={node.key === tabStop}
                isDragged={node.key === dragKey}
                drop={indicator}
                visual={nodeVisual(node, isOpen, typesById)}
                onClick={() => {
                  if (!justDropped.current) activate(row);
                }}
                onToggle={(event) => {
                  event.stopPropagation();
                  setActiveKey(node.key);
                  setOpen(node.key, !isOpen);
                }}
                onFocus={() => setActiveKey(node.key)}
                onKeyDown={(event) => onKeyDown(event, item.index)}
              />
            );
          })}
        </div>
      </div>
      {/* In <body>: the glass panel's backdrop-filter would make it the
          containing block of the fixed overlay, shifting it off the pointer. */}
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {dragged && <DragPreview visual={nodeVisual(dragged, false, typesById)} />}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

type Visual = { Icon: LucideIcon; color?: string; label: string };

function nodeLabel(node: TreeNode): string {
  return node.kind === "folder" ? node.folder.name : node.document.title;
}

function nodeVisual(
  node: TreeNode,
  isOpen: boolean,
  typesById: ReadonlyMap<string, CardType>,
): Visual {
  if (node.kind === "folder") {
    const Icon =
      node.folder.icon === "folder" ? (isOpen ? FolderOpen : Folder) : typeIcon(node.folder.icon);
    return { Icon, label: node.folder.name };
  }
  const type = node.document.typeId ? typesById.get(node.document.typeId) : undefined;
  return {
    Icon: typeIcon(type?.icon ?? "shapes"),
    color: typeColor(type?.color ?? "slate"),
    label: node.document.title,
  };
}

type TreeItemProps = {
  row: TreeRow;
  top: number;
  isOpen: boolean;
  isCurrent: boolean;
  isTabStop: boolean;
  isDragged: boolean;
  drop: DropPosition | "refused" | undefined;
  visual: Visual;
  onClick: () => void;
  onToggle: (event: MouseEvent) => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

/** One row: a `treeitem`, draggable with the pointer and a drop target. */
function TreeItem({
  row,
  top,
  isOpen,
  isCurrent,
  isTabStop,
  isDragged,
  drop,
  visual: { Icon, color, label },
  onClick,
  onToggle,
  onFocus,
  onKeyDown,
}: TreeItemProps) {
  const { node } = row;
  const hasChildren = node.children.length > 0;
  // Only the pointer listeners: the row keeps its tree role and tab stop
  // (dnd-kit's attributes would turn it into a button).
  const { setNodeRef: setDragRef, listeners } = useDraggable({ id: node.key });
  const { setNodeRef: setDropRef } = useDroppable({ id: node.key });
  const setRef = useCallback(
    (element: HTMLElement | null) => {
      setDragRef(element);
      setDropRef(element);
    },
    [setDragRef, setDropRef],
  );
  return (
    <div
      ref={setRef}
      {...listeners}
      role="treeitem"
      data-key={node.key}
      data-drop={drop}
      tabIndex={isTabStop ? 0 : -1}
      aria-level={row.level}
      aria-posinset={row.position}
      aria-setsize={row.siblings}
      aria-expanded={hasChildren ? isOpen : undefined}
      aria-selected={node.kind === "document" ? isCurrent : undefined}
      aria-current={isCurrent ? "page" : undefined}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className={`absolute left-0 flex w-full cursor-default items-center gap-1.5 rounded-md pr-2 text-sm text-muted-foreground outline-none select-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-secondary aria-[current=page]:text-foreground data-[drop=after]:shadow-[inset_0_-2px_0_0_var(--color-primary)] data-[drop=before]:shadow-[inset_0_2px_0_0_var(--color-primary)] data-[drop=inside]:bg-primary/15 data-[drop=inside]:ring-1 data-[drop=inside]:ring-primary data-[drop=refused]:cursor-not-allowed data-[drop=refused]:bg-destructive/10 data-[drop=refused]:ring-1 data-[drop=refused]:ring-destructive ${isDragged ? "opacity-40" : ""}`}
      style={{
        height: ROW_HEIGHT,
        // `top`, not a transform: dnd-kit measures drop targets without
        // transforms, so translated rows would all sit on the first one.
        top,
        paddingLeft: 4 + (row.level - 1) * INDENT,
      }}
    >
      {hasChildren ? (
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 transition-transform data-[open=true]:rotate-90"
          data-open={isOpen}
          onClick={onToggle}
        />
      ) : (
        <span aria-hidden className="size-4 shrink-0" />
      )}
      <Icon aria-hidden className="size-4 shrink-0" style={color ? { color } : undefined} />
      <span className="truncate">{label}</span>
    </div>
  );
}

/** What follows the pointer while dragging. */
function DragPreview({ visual: { Icon, color, label } }: { visual: Visual }) {
  return (
    <div className="glass flex h-8 w-fit max-w-60 items-center gap-1.5 rounded-md px-2 text-sm shadow-md">
      <Icon aria-hidden className="size-4 shrink-0" style={color ? { color } : undefined} />
      <span className="truncate">{label}</span>
    </div>
  );
}
