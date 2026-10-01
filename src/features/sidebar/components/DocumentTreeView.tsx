import { useNavigate, useParams } from "@tanstack/react-router";
import { defaultRangeExtractor, type Range, useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import type { DocumentTree } from "@/lib/bindings";
import { ancestorKeys, buildTree, documentKey, type TreeRow, visibleRows } from "../tree";

/** Height of a row, in pixels: fixed, so thousands of rows scroll without measuring. */
const ROW_HEIGHT = 32;
/** Indentation per level, in pixels. */
const INDENT = 16;

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

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (index) => rows[index]?.node.key ?? index,
    // The tab stop stays in the page even when scrolled away, so Tab can
    // always come back into the tree.
    rangeExtractor: useCallback(
      (range: Range) => {
        const indexes = defaultRangeExtractor(range);
        if (tabStopIndex >= 0 && !indexes.includes(tabStopIndex)) {
          indexes.push(tabStopIndex);
          indexes.sort((a, b) => a - b);
        }
        return indexes;
      },
      [tabStopIndex],
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
    const element = scrollRef.current?.querySelector<HTMLElement>(
      `[data-key="${CSS.escape(key)}"]`,
    );
    if (element) {
      pendingFocus.current = null;
      element.focus({ preventScroll: true });
    }
  });

  const moveTo = (index: number) => {
    const row = rows[index];
    if (!row) return;
    pendingFocus.current = row.node.key;
    setActiveKey(row.node.key);
    virtualizer.scrollToIndex(index, { align: "auto" });
  };

  const setOpen = (key: string, open: boolean) =>
    setExpanded((previous) => {
      if (previous.has(key) === open) return previous;
      const next = new Set(previous);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });

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

  return (
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
          const hasChildren = node.children.length > 0;
          const isOpen = hasChildren && expanded.has(node.key);
          const isCurrent = node.key === currentKey;
          let Icon = isOpen ? FolderOpen : Folder;
          let color: string | undefined;
          let label: string;
          if (node.kind === "folder") {
            if (node.folder.icon !== "folder") Icon = typeIcon(node.folder.icon);
            label = node.folder.name;
          } else {
            const type = node.document.typeId ? typesById.get(node.document.typeId) : undefined;
            Icon = typeIcon(type?.icon ?? "shapes");
            color = typeColor(type?.color ?? "slate");
            label = node.document.title;
          }
          return (
            <div
              key={item.key}
              role="treeitem"
              data-key={node.key}
              tabIndex={node.key === tabStop ? 0 : -1}
              aria-level={row.level}
              aria-posinset={row.position}
              aria-setsize={row.siblings}
              aria-expanded={hasChildren ? isOpen : undefined}
              aria-selected={node.kind === "document" ? isCurrent : undefined}
              aria-current={isCurrent ? "page" : undefined}
              onClick={() => activate(row)}
              onFocus={() => setActiveKey(node.key)}
              onKeyDown={(event) => onKeyDown(event, item.index)}
              className="absolute top-0 left-0 flex w-full cursor-default items-center gap-1.5 rounded-md pr-2 text-sm text-muted-foreground outline-none select-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-secondary aria-[current=page]:text-foreground"
              style={{
                height: ROW_HEIGHT,
                transform: `translateY(${item.start}px)`,
                paddingLeft: 4 + (row.level - 1) * INDENT,
              }}
            >
              {hasChildren ? (
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 transition-transform data-[open=true]:rotate-90"
                  data-open={isOpen}
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveKey(node.key);
                    setOpen(node.key, !isOpen);
                  }}
                />
              ) : (
                <span aria-hidden className="size-4 shrink-0" />
              )}
              <Icon aria-hidden className="size-4 shrink-0" style={color ? { color } : undefined} />
              <span className="truncate">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
