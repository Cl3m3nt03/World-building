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
import {
  ArrowUpRight,
  ChevronRight,
  Copy,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Globe,
  LayoutGrid,
  type LucideIcon,
  Map as MapIcon,
  Network,
  Pencil,
  Pin,
  PinOff,
  Shapes,
  Share2,
  Trash2,
} from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import { CreateCardContextMenu } from "@/features/cards";
import type { CardType, DocumentTree } from "@/lib/bindings";
import { dropCard } from "@/lib/cardDrop";
import { documentRoute } from "@/lib/documentRoute";
import {
  useCreateFolder,
  useDuplicateDocument,
  useMoveInTree,
  useRenameDocument,
  useSetPinned,
  useTrashDocument,
  useUpdateFolder,
} from "../hooks/useDocumentTree";
import {
  ancestorKeys,
  buildTree,
  DEFAULT_VIEW,
  type DropPosition,
  documentKey,
  dropMove,
  folderKey,
  isFiltered,
  type Move,
  type TreeNode,
  type TreeRow,
  type TreeView,
  viewTree,
  visibleRows,
} from "../tree";
import { DeleteFolderDialog, FolderIconDialog, folderIcon } from "./FolderDialogs";
import { MoveToDialog } from "./MoveToDialog";

/** Height of a row, in pixels: fixed, so thousands of rows scroll without measuring. */
const ROW_HEIGHT = 32;
/** Indentation per level, in pixels. */
const INDENT = 16;
/** Hovering a closed folder or parent this long while dragging opens it. */
const OPEN_ON_HOVER_MS = 700;

/** Where a drag would land: the row under the pointer, and the move it makes. */
type Drop = { key: string; position: DropPosition; move: Move | "refused" | null };

/** What the rest of the sidebar can ask of the tree. */
export type DocumentTreeHandle = {
  /** Creates a folder at the end of the root and lets its name be typed. */
  newFolder: () => void;
};

type Props = {
  tree: DocumentTree;
  /** The document open in the workspace, if any. */
  currentId: string | null;
  /** Filters and sort (the sidebar's view menu). */
  view: TreeView;
  onViewChange: (view: TreeView) => void;
  /** Keys of the folders and parents open when the tree first shows. */
  initialExpanded: string[];
  /** Called when folders or parents open or close (to remember them). */
  onExpandedChange: (expanded: string[]) => void;
  /** "New map" from the right click (M4). */
  onNewMap: () => void;
  onNewGraph: () => void;
  /** "New tree" from the right click (M6). */
  onNewTree: () => void;
  /** "New canvas" from the right click (M7). */
  onNewCanvas: () => void;
  ref?: Ref<DocumentTreeHandle>;
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
 * Folders are made from the bottom bar or a right click, and named at once
 * in their row; a folder's right click (or F2 / Delete) renames it, changes
 * its icon or deletes it.
 *
 * Which folders are open is kept for the session; per world in step 3.9.
 */
export function DocumentTreeView({
  tree,
  currentId,
  view,
  onViewChange,
  initialExpanded,
  onExpandedChange,
  onNewMap,
  onNewGraph,
  onNewTree,
  onNewCanvas,
  ref,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const types = useCardTypes();

  const roots = useMemo(() => buildTree(tree), [tree]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(initialExpanded));
  // Every change after the first render is remembered (per world, ADR 0005).
  const reportExpanded = useRef(onExpandedChange);
  reportExpanded.current = onExpandedChange;
  const firstExpanded = useRef(expanded);
  useEffect(() => {
    if (expanded === firstExpanded.current) return;
    reportExpanded.current([...expanded]);
  }, [expanded]);
  // Filters and sort: a card type stands for its subtypes too.
  const typeIds = useMemo(() => {
    const chosen = new Set(view.typeIds);
    for (const type of types.data ?? []) {
      if (type.parentId !== null && chosen.has(type.parentId)) chosen.add(type.id);
    }
    return [...chosen];
  }, [view.typeIds, types.data]);
  const shown = useMemo(() => viewTree(roots, { ...view, typeIds }), [roots, view, typeIds]);
  const filtered = isFiltered(view);
  const sorted = view.sort !== "manual";
  // Filtering opens what holds the matches, so they are in sight.
  const filterKey = `${view.kinds.join()}|${view.typeIds.join()}`;
  const openedFor = useRef("|");
  useEffect(() => {
    if (openedFor.current === filterKey) return;
    openedFor.current = filterKey;
    if (!filtered) return;
    const parents: string[] = [];
    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.children.length > 0) parents.push(node.key);
        walk(node.children);
      }
    };
    walk(shown.roots);
    setExpanded((previous) => new Set([...previous, ...parents]));
  }, [filterKey, filtered, shown.roots]);
  const rows = useMemo(() => visibleRows(shown.roots, expanded), [shown.roots, expanded]);
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
      void navigate(documentRoute(worldId, row.node.document.kind, row.node.document.id));
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
      case "F2":
        setEditingKey(row.node.key);
        break;
      case "Delete":
        if (row.node.kind === "folder") setDeleteKey(row.node.key);
        else trashDocument(row.node);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  // --- Folders -----------------------------------------------------------------

  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  // The folder whose name is being typed, in its row.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [iconFolderId, setIconFolderId] = useState<string | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  // A row to scroll to (and focus) once the tree has it, e.g. a new folder.
  const [revealKey, setRevealKey] = useState<string | null>(null);
  // The row a right click was made on (`null`: the empty space below them).
  const [menuKey, setMenuKey] = useState<string | null>(null);
  // A menu action that moves the focus (a name to type, a dialog) runs once
  // the menu is gone: while it is open, its focus trap takes the focus back.
  const afterMenu = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (revealKey === null) return;
    const index = indexOf.get(revealKey);
    if (index === undefined) return;
    setRevealKey(null);
    setActiveKey(revealKey);
    virtualizer.scrollToIndex(index, { align: "auto" });
  }, [revealKey, indexOf, virtualizer]);

  const newFolder = (parentId: string | null) => {
    createFolder.mutate(
      { parentId, name: t("sidebar.folder.defaultName") },
      {
        onSuccess: (folder) => {
          if (parentId) setOpen(folderKey(parentId), true);
          setEditingKey(folderKey(folder.id));
          setRevealKey(folderKey(folder.id));
        },
      },
    );
  };
  useImperativeHandle(ref, () => ({ newFolder: () => newFolder(null) }));

  const renameDocument = useRenameDocument();
  const finishRename = (node: TreeNode, name: string | null) => {
    setEditingKey(null);
    pendingFocus.current = node.key;
    const trimmed = name?.trim() ?? "";
    // Cancelled, emptied or unchanged: the name stays.
    if (trimmed === "" || trimmed === nodeLabel(node)) return;
    if (node.kind === "folder") {
      updateFolder.mutate({ id: node.folder.id, patch: { name: trimmed } });
    } else {
      renameDocument.mutate({ id: node.document.id, title: trimmed });
    }
  };

  const allNodes = useMemo(() => {
    const map = new Map<string, TreeNode>();
    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        map.set(node.key, node);
        walk(node.children);
      }
    };
    walk(roots);
    return map;
  }, [roots]);
  const folderNode = (key: string | null) => {
    const node = key ? allNodes.get(key) : undefined;
    return node?.kind === "folder" ? node : null;
  };
  const menuFolder = folderNode(menuKey);
  const iconFolder = iconFolderId
    ? (tree.folders.find((folder) => folder.id === iconFolderId) ?? null)
    : null;

  const folderMenu = menuFolder && (
    <>
      <ContextMenuItem onSelect={() => newFolder(menuFolder.folder.id)}>
        <FolderPlus />
        {t("sidebar.folder.newSub")}
      </ContextMenuItem>
      <ContextMenuItem
        onSelect={() => {
          afterMenu.current = () => setEditingKey(menuFolder.key);
        }}
      >
        <Pencil />
        {t("sidebar.folder.rename")}
        <ContextMenuShortcut>{t("sidebar.folder.renameKey")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        onSelect={() => {
          afterMenu.current = () => setIconFolderId(menuFolder.folder.id);
        }}
      >
        <Shapes />
        {t("sidebar.folder.changeIcon")}
      </ContextMenuItem>
      <ContextMenuItem
        variant="destructive"
        onSelect={() => {
          afterMenu.current = () => setDeleteKey(menuFolder.key);
        }}
      >
        <Trash2 />
        {t("sidebar.folder.delete")}
        <ContextMenuShortcut>{t("sidebar.folder.deleteKey")}</ContextMenuShortcut>
      </ContextMenuItem>
    </>
  );
  // --- Documents ---------------------------------------------------------------

  const setPinned = useSetPinned();
  const duplicate = useDuplicateDocument();
  const trash = useTrashDocument();
  // The document whose "Move to…" dialog is open.
  const [moveKey, setMoveKey] = useState<string | null>(null);
  const documentNode = (key: string | null) => {
    const node = key ? allNodes.get(key) : undefined;
    return node?.kind === "document" ? node : null;
  };

  /** Trashes a document; the focus goes to the row after it (or before). */
  function trashDocument(node: TreeNode & { kind: "document" }) {
    const index = indexOf.get(node.key);
    const next = index === undefined ? undefined : (rows[index + 1] ?? rows[index - 1]);
    trash.mutate(node.document.id, {
      onSuccess: () => {
        if (next) {
          pendingFocus.current = next.node.key;
          setActiveKey(next.node.key);
        }
        if (node.key === currentKey) {
          void navigate({ to: "/world/$worldId/world", params: { worldId } });
        }
      },
    });
  }

  const menuDocumentNode = documentNode(menuKey);
  const documentMenu = menuDocumentNode && (
    <DocumentMenu
      node={menuDocumentNode}
      onOpen={() => {
        const row = rows[indexOf.get(menuDocumentNode.key) ?? -1];
        if (row) activate(row);
      }}
      onRename={() => {
        afterMenu.current = () => setEditingKey(menuDocumentNode.key);
      }}
      onPin={(pinned) => setPinned.mutate({ id: menuDocumentNode.document.id, pinned })}
      onDuplicate={() =>
        duplicate.mutate(
          {
            id: menuDocumentNode.document.id,
            kind: menuDocumentNode.document.kind,
            title: t("sidebar.document.copyTitle", { title: menuDocumentNode.document.title }),
          },
          {
            onSuccess: (copyId) => {
              pendingFocus.current = documentKey(copyId);
              setRevealKey(documentKey(copyId));
            },
          },
        )
      }
      onMove={() => {
        afterMenu.current = () => setMoveKey(menuDocumentNode.key);
      }}
      onTrash={() => trashDocument(menuDocumentNode)}
    />
  );
  const rootMenu = (
    <>
      <ContextMenuItem onSelect={() => newFolder(null)}>
        <FolderPlus />
        {t("sidebar.folder.new")}
      </ContextMenuItem>
      <ContextMenuItem onSelect={onNewMap}>
        <MapIcon />
        {t("sidebar.newMap")}
      </ContextMenuItem>
      <ContextMenuItem onSelect={onNewGraph}>
        <Share2 />
        {t("sidebar.newGraph")}
      </ContextMenuItem>
      <ContextMenuItem onSelect={onNewTree}>
        <Network />
        {t("sidebar.newTree")}
      </ContextMenuItem>
      <ContextMenuItem onSelect={onNewCanvas}>
        <LayoutGrid />
        {t("sidebar.newCanvas")}
      </ContextMenuItem>
    </>
  );

  // --- Drag and drop -----------------------------------------------------------

  const move = useMoveInTree();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [drop, setDrop] = useState<Drop | null>(null);
  const pointerY = useRef(0);
  // Where the pointer is across the window: a card dropped outside the tree
  // goes to what is there (a map, M4).
  const pointerX = useRef(0);
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
      pointerX.current = event.clientX;
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
      pointerX.current = start.clientX;
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
    // Sorted by name or date, a row cannot be put before or after another:
    // only filed inside.
    if (sorted && position !== "inside") {
      setDrop(null);
      clearHover();
      return;
    }
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

  const dragged = dragKey ? nodeOf.get(dragKey) : undefined;

  /** Whether the pointer is over the tree (a drop there files the row). */
  const overTree = () =>
    document.elementFromPoint(pointerX.current, pointerY.current)?.closest("aside") !== null;

  const onDragEnd = () => {
    justDropped.current = true;
    window.setTimeout(() => {
      justDropped.current = false;
    }, 0);
    if (drop?.move && drop.move !== "refused") {
      // Filed inside: open it, so the dropped row stays in sight.
      if (drop.position === "inside") setOpen(drop.key, true);
      move.mutate(drop.move);
    } else if (dragged?.kind === "document" && dragged.document.kind === "card" && !overTree()) {
      dropCard({
        cardId: dragged.document.id,
        clientX: pointerX.current,
        clientY: pointerY.current,
      });
    }
    endDrag();
  };

  const error =
    move.error ??
    createFolder.error ??
    updateFolder.error ??
    setPinned.error ??
    renameDocument.error ??
    duplicate.error ??
    trash.error;

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
      {error && (
        <div className="px-2 pt-2">
          <AppErrorMessage error={error} />
        </div>
      )}
      {sorted && rows.length > 0 && (
        <p className="mx-2 flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          {view.sort === "name" ? t("sidebar.view.sortedByName") : t("sidebar.view.sortedByDate")}
          <button
            type="button"
            onClick={() => onViewChange({ ...view, sort: "manual", reversed: false })}
            className="shrink-0 rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("sidebar.view.backToManual")}
          </button>
        </p>
      )}
      <CreateCardContextMenu
        before={folderMenu || documentMenu || undefined}
        after={menuFolder ? undefined : rootMenu}
        create={!menuFolder}
        createLabel={menuDocumentNode ? t("sidebar.newCard") : undefined}
        onCloseAutoFocus={(event) => {
          const run = afterMenu.current;
          afterMenu.current = null;
          if (!run) return;
          event.preventDefault();
          run();
        }}
      >
        {rows.length === 0 ? (
          // An empty world (or nothing matching): room for the right click.
          <div className="min-h-0 flex-1 p-2" onContextMenuCapture={() => setMenuKey(null)}>
            {filtered && roots.length > 0 ? (
              <p className="flex flex-col items-center gap-2 p-2 text-center text-xs text-muted-foreground">
                {t("sidebar.view.noMatch")}
                <Button size="sm" variant="secondary" onClick={() => onViewChange(DEFAULT_VIEW)}>
                  {t("sidebar.view.reset")}
                </Button>
              </p>
            ) : (
              <p className="p-2 text-center text-xs text-muted-foreground">{t("sidebar.empty")}</p>
            )}
          </div>
        ) : (
          <div
            ref={scrollRef}
            role="tree"
            aria-label={t("sidebar.tree")}
            data-tree-viewport=""
            className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2"
            onContextMenuCapture={(event) => {
              const row = (event.target as HTMLElement).closest<HTMLElement>("[data-key]");
              setMenuKey(row?.dataset.key ?? null);
            }}
          >
            <div
              role="none"
              className="relative w-full"
              style={{ height: virtualizer.getTotalSize() }}
            >
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
                    isContext={shown.context.has(node.key)}
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
                    editing={node.key === editingKey}
                    onRenamed={(name) => finishRename(node, name)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </CreateCardContextMenu>
      <FolderIconDialog folder={iconFolder} onClose={() => setIconFolderId(null)} />
      <DeleteFolderDialog node={folderNode(deleteKey)} onClose={() => setDeleteKey(null)} />
      <MoveToDialog
        node={documentNode(moveKey)}
        roots={roots}
        onClose={() => {
          if (moveKey) pendingFocus.current = moveKey;
          setMoveKey(null);
        }}
        onPick={(destination) => {
          const key = moveKey;
          if (!key) return;
          move.mutate(destination.move);
          if (destination.key !== "root") setOpen(destination.key, true);
          setRevealKey(key);
        }}
      />
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

type DocumentMenuProps = {
  node: TreeNode & { kind: "document" };
  onOpen: () => void;
  onRename: () => void;
  onPin: (pinned: boolean) => void;
  onDuplicate: () => void;
  onMove: () => void;
  onTrash: () => void;
};

/** A document's right click: what can be done to it (card creation follows). */
function DocumentMenu({
  node,
  onOpen,
  onRename,
  onPin,
  onDuplicate,
  onMove,
  onTrash,
}: DocumentMenuProps) {
  const { t } = useTranslation();
  const pinned = node.document.pinnedOrder !== null;
  return (
    <>
      <ContextMenuItem onSelect={onOpen}>
        <ArrowUpRight />
        {t("sidebar.document.open")}
        <ContextMenuShortcut>{t("sidebar.document.openKey")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onSelect={onRename}>
        <Pencil />
        {t("sidebar.folder.rename")}
        <ContextMenuShortcut>{t("sidebar.folder.renameKey")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => onPin(!pinned)}>
        {pinned ? <PinOff /> : <Pin />}
        {pinned ? t("sidebar.pins.unpin") : t("sidebar.pins.pin")}
      </ContextMenuItem>
      <ContextMenuItem onSelect={onDuplicate}>
        <Copy />
        {t("sidebar.document.duplicate")}
      </ContextMenuItem>
      <ContextMenuItem onSelect={onMove}>
        <FolderInput />
        {t("sidebar.document.moveTo")}
      </ContextMenuItem>
      <ContextMenuItem disabled>
        <Globe />
        {t("sidebar.document.wiki")}
        <ContextMenuShortcut>{t("sidebar.document.soon", { milestone: "M8" })}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onSelect={onTrash}>
        <Trash2 />
        {t("sidebar.document.trash")}
        <ContextMenuShortcut>{t("sidebar.folder.deleteKey")}</ContextMenuShortcut>
      </ContextMenuItem>
    </>
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
      node.folder.icon === "folder" && isOpen ? FolderOpen : folderIcon(node.folder.icon);
    return { Icon, label: node.folder.name };
  }
  if (node.document.kind === "map") return { Icon: MapIcon, label: node.document.title };
  if (node.document.kind === "graph") return { Icon: Share2, label: node.document.title };
  if (node.document.kind === "tree") return { Icon: Network, label: node.document.title };
  if (node.document.kind === "canvas") return { Icon: LayoutGrid, label: node.document.title };
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
  /** Shown only because a match is inside it (filters). */
  isContext: boolean;
  drop: DropPosition | "refused" | undefined;
  visual: Visual;
  onClick: () => void;
  onToggle: (event: MouseEvent) => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  /** The name is being typed, in an input in place of the label. */
  editing: boolean;
  /** The typed name, or `null` when cancelled (Escape). */
  onRenamed: (name: string | null) => void;
};

/** One row: a `treeitem`, draggable with the pointer and a drop target. */
function TreeItem({
  row,
  top,
  isOpen,
  isCurrent,
  isTabStop,
  isDragged,
  isContext,
  drop,
  visual: { Icon, color, label },
  onClick,
  onToggle,
  onFocus,
  onKeyDown,
  editing,
  onRenamed,
}: TreeItemProps) {
  const { t } = useTranslation();
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
      data-context={isContext || undefined}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className={`absolute left-0 flex w-full cursor-default items-center gap-1.5 rounded-md pr-2 text-sm text-muted-foreground outline-none select-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-secondary aria-[current=page]:text-foreground data-[drop=after]:shadow-[inset_0_-2px_0_0_var(--color-primary)] data-[drop=before]:shadow-[inset_0_2px_0_0_var(--color-primary)] data-[drop=inside]:bg-primary/15 data-[drop=inside]:ring-1 data-[drop=inside]:ring-primary data-[drop=refused]:cursor-not-allowed data-[drop=refused]:bg-destructive/10 data-[drop=refused]:ring-1 data-[drop=refused]:ring-destructive data-context:opacity-60 ${isDragged ? "opacity-40" : ""}`}
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
      {editing ? (
        <RenameInput
          label={node.kind === "folder" ? t("sidebar.folder.name") : t("sidebar.document.name")}
          name={label}
          onDone={onRenamed}
        />
      ) : (
        <span className="truncate">{label}</span>
      )}
    </div>
  );
}

/** The name of a row, typed in place: Enter or leaving keeps it, Escape cancels. */
function RenameInput({
  label,
  name,
  onDone,
}: {
  label: string;
  name: string;
  onDone: (name: string | null) => void;
}) {
  const done = useRef(false);
  const finish = (value: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(value);
  };
  return (
    <input
      aria-label={label}
      defaultValue={name}
      maxLength={100}
      // biome-ignore lint/a11y/noAutofocus: the input appears because its name is to be typed now.
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => finish(event.currentTarget.value)}
      onKeyDown={(event) => {
        // The row's keys (arrows, Enter, Space…) are the input's here.
        event.stopPropagation();
        if (event.key === "Enter") finish(event.currentTarget.value);
        if (event.key === "Escape") finish(null);
      }}
      // Selecting text with the mouse must not drag the row.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      className="h-6 min-w-0 flex-1 rounded-sm border border-ring bg-background px-1 text-sm text-foreground outline-none"
    />
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
