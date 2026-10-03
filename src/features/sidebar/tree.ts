import type { DocumentTree, Folder, Place, SidebarView, TreeDocument } from "@/lib/bindings";

/**
 * The sidebar tree (M3, docs/features/02-organisation.md), built from the
 * flat lists the Rust gives (`document_tree`): folders and documents of a
 * place share one order; a document's children are under it.
 */
export type TreeNode =
  | { kind: "folder"; key: string; folder: Folder; children: TreeNode[] }
  | { kind: "document"; key: string; document: TreeDocument; children: TreeNode[] };

/** A row of the sidebar as shown: a node, its depth and its siblings. */
export type TreeRow = {
  node: TreeNode;
  /** 1 at the root (`aria-level`). */
  level: number;
  /** 1-based position among its siblings, and their number (`aria-posinset`, `aria-setsize`). */
  position: number;
  siblings: number;
  /** Key of the enclosing node, `null` at the root. */
  parentKey: string | null;
};

export const folderKey = (id: string) => `f:${id}`;
export const documentKey = (id: string) => `d:${id}`;

function byOrder(a: TreeNode, b: TreeNode): number {
  const order = (node: TreeNode) =>
    node.kind === "folder" ? node.folder.sortOrder : node.document.sortOrder;
  const rank = (node: TreeNode) => (node.kind === "folder" ? 0 : 1);
  return order(a) - order(b) || rank(a) - rank(b);
}

/** The root's nodes, each with its content, in their order. */
export function buildTree(tree: DocumentTree): TreeNode[] {
  const folderNodes = new Map<string, TreeNode & { kind: "folder" }>();
  const documentNodes = new Map<string, TreeNode & { kind: "document" }>();
  for (const folder of tree.folders) {
    folderNodes.set(folder.id, { kind: "folder", key: folderKey(folder.id), folder, children: [] });
  }
  for (const document of tree.documents) {
    documentNodes.set(document.id, {
      kind: "document",
      key: documentKey(document.id),
      document,
      children: [],
    });
  }

  const roots: TreeNode[] = [];
  for (const node of folderNodes.values()) {
    const parent = node.folder.parentId ? folderNodes.get(node.folder.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  for (const node of documentNodes.values()) {
    const { parentId, folderId } = node.document;
    // A place that is not in the lists (should not happen) shows at the root.
    const parent =
      (parentId ? documentNodes.get(parentId) : undefined) ??
      (folderId ? folderNodes.get(folderId) : undefined);
    (parent ? parent.children : roots).push(node);
  }

  const sort = (nodes: TreeNode[]) => {
    nodes.sort(byOrder);
    for (const node of nodes) sort(node.children);
  };
  sort(roots);
  return roots;
}

/** The rows shown: the nodes, and the content of those in `expanded`. */
export function visibleRows(roots: TreeNode[], expanded: ReadonlySet<string>): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (nodes: TreeNode[], level: number, parentKey: string | null) => {
    nodes.forEach((node, index) => {
      rows.push({ node, level, position: index + 1, siblings: nodes.length, parentKey });
      if (node.children.length > 0 && expanded.has(node.key)) {
        walk(node.children, level + 1, node.key);
      }
    });
  };
  walk(roots, 1, null);
  return rows;
}

/** Keys of the folders and documents enclosing the document `id`, outermost first. */
export function ancestorKeys(tree: DocumentTree, id: string): string[] {
  const documents = new Map(tree.documents.map((d) => [d.id, d]));
  const folders = new Map(tree.folders.map((f) => [f.id, f]));
  const keys: string[] = [];
  const seen = new Set<string>();
  let document = documents.get(id);
  let folderId: string | null = null;
  while (document && !seen.has(document.id)) {
    seen.add(document.id);
    if (document.parentId) {
      keys.push(documentKey(document.parentId));
      document = documents.get(document.parentId);
    } else {
      folderId = document.folderId;
      break;
    }
  }
  while (folderId && !seen.has(folderId)) {
    seen.add(folderId);
    keys.push(folderKey(folderId));
    folderId = folders.get(folderId)?.parentId ?? null;
  }
  return keys.reverse();
}

// --- Drag and drop (step 3.3) ---------------------------------------------------

/** Where a dragged row lands, relative to the row under the pointer. */
export type DropPosition = "before" | "after" | "inside";

/** A move as the Rust takes it: the place, and the index there once the
 * moved item is taken out (`move_document` / `move_folder`). */
export type Move =
  | { kind: "document"; id: string; place: Place; index: number }
  | { kind: "folder"; id: string; parentId: string | null; index: number };

type Located = { node: TreeNode; parent: TreeNode | null; siblings: TreeNode[] };

function locate(roots: TreeNode[]): Map<string, Located> {
  const map = new Map<string, Located>();
  const walk = (nodes: TreeNode[], parent: TreeNode | null) => {
    for (const node of nodes) {
      map.set(node.key, { node, parent, siblings: nodes });
      walk(node.children, node);
    }
  };
  walk(roots, null);
  return map;
}

function placeOf(parent: TreeNode | null): Place {
  if (parent === null) return { kind: "root" };
  return parent.kind === "folder"
    ? { kind: "folder", id: parent.folder.id }
    : { kind: "parent", id: parent.document.id };
}

const idOf = (node: TreeNode) => (node.kind === "folder" ? node.folder.id : node.document.id);

/**
 * The move made by dropping `dragKey` `position` the row `targetKey`:
 * `"refused"` when it is not allowed (into itself or one of its
 * descendants, a folder under a document), `null` when nothing would change.
 */
export function dropMove(
  roots: TreeNode[],
  dragKey: string,
  targetKey: string,
  position: DropPosition,
): Move | "refused" | null {
  const map = locate(roots);
  const dragged = map.get(dragKey);
  const target = map.get(targetKey);
  if (!dragged || !target) return null;
  if (dragKey === targetKey) return null;
  let at: TreeNode | null = target.node;
  while (at) {
    if (at.key === dragKey) return "refused";
    at = map.get(at.key)?.parent ?? null;
  }

  let container: TreeNode | null;
  let index: number;
  if (position === "inside") {
    container = target.node;
    index = target.node.children.filter((child) => child.key !== dragKey).length;
  } else {
    container = target.parent;
    const siblings = target.siblings.filter((sibling) => sibling.key !== dragKey);
    index = siblings.indexOf(target.node) + (position === "after" ? 1 : 0);
  }
  if (dragged.node.kind === "folder" && container?.kind === "document") return "refused";

  // Same place, same index: nothing to do.
  if (container?.key === dragged.parent?.key) {
    const current = dragged.siblings.indexOf(dragged.node);
    if (current === index) return null;
  }
  const id = idOf(dragged.node);
  if (dragged.node.kind === "folder") {
    return { kind: "folder", id, parentId: container ? idOf(container) : null, index };
  }
  return { kind: "document", id, place: placeOf(container), index };
}

/** The tree after `move`, as the Rust will have it (shown before it answers). */
export function applyMove(tree: DocumentTree, move: Move): DocumentTree {
  const folders = tree.folders.map((folder) => ({ ...folder }));
  const documents = tree.documents.map((document) => ({ ...document }));
  const movedFolder = move.kind === "folder" ? folders.find((f) => f.id === move.id) : undefined;
  const movedDocument =
    move.kind === "document" ? documents.find((d) => d.id === move.id) : undefined;
  if (!movedFolder && !movedDocument) return tree;

  type Entry = Folder | TreeDocument;
  const inPlace = (place: Place): Entry[] => {
    const entries: Entry[] =
      place.kind === "parent"
        ? documents.filter((d) => d.parentId === place.id)
        : [
            ...folders.filter((f) => f.parentId === (place.kind === "folder" ? place.id : null)),
            ...documents.filter(
              (d) =>
                d.parentId === null && d.folderId === (place.kind === "folder" ? place.id : null),
            ),
          ];
    return entries.sort((a, b) => a.sortOrder - b.sortOrder);
  };
  const renumber = (entries: Entry[]) => {
    entries.forEach((entry, index) => {
      entry.sortOrder = index;
    });
  };

  let from: Place;
  let to: Place;
  const moved = (movedFolder ?? movedDocument) as Entry;
  if (movedFolder && move.kind === "folder") {
    from = movedFolder.parentId ? { kind: "folder", id: movedFolder.parentId } : { kind: "root" };
    to = move.parentId ? { kind: "folder", id: move.parentId } : { kind: "root" };
    movedFolder.parentId = move.parentId;
  } else if (movedDocument && move.kind === "document") {
    from = movedDocument.parentId
      ? { kind: "parent", id: movedDocument.parentId }
      : movedDocument.folderId
        ? { kind: "folder", id: movedDocument.folderId }
        : { kind: "root" };
    to = move.place;
    movedDocument.parentId = to.kind === "parent" ? to.id : null;
    movedDocument.folderId = to.kind === "folder" ? to.id : null;
  } else {
    return tree;
  }
  renumber(inPlace(from).filter((entry) => entry !== moved));
  const destination = inPlace(to).filter((entry) => entry !== moved);
  destination.splice(Math.min(move.index, destination.length), 0, moved);
  renumber(destination);
  return { folders, documents };
}

// --- Pins (step 3.5) -------------------------------------------------------------

/** The pinned documents, in their pin order. */
export function pinnedDocuments(tree: DocumentTree): TreeDocument[] {
  return tree.documents
    .filter((document) => document.pinnedOrder !== null)
    .sort((a, b) => (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0));
}

/** The tree with `id` pinned (at the end) or unpinned, pins numbered 0..n. */
export function applyPinned(tree: DocumentTree, id: string, pinned: boolean): DocumentTree {
  const pins = pinnedDocuments(tree).map((document) => document.id);
  const has = pins.includes(id);
  if (pinned === has || !tree.documents.some((document) => document.id === id)) return tree;
  return withPins(tree, pinned ? [...pins, id] : pins.filter((pin) => pin !== id));
}

/** The tree with the pinned `id` moved to `index` among the pins (counted without it). */
export function applyPinMove(tree: DocumentTree, id: string, index: number): DocumentTree {
  const pins = pinnedDocuments(tree).map((document) => document.id);
  if (!pins.includes(id)) return tree;
  const others = pins.filter((pin) => pin !== id);
  others.splice(Math.min(index, others.length), 0, id);
  return withPins(tree, others);
}

function withPins(tree: DocumentTree, pins: string[]): DocumentTree {
  const order = new Map(pins.map((id, index) => [id, index]));
  return {
    folders: tree.folders,
    documents: tree.documents.map((document) => ({
      ...document,
      pinnedOrder: order.get(document.id) ?? null,
    })),
  };
}

// --- Move to… (step 3.6) ------------------------------------------------------

/** Where "Move to…" can put a document: the root, a folder, or under a document. */
export type Destination = {
  /** `"root"`, or the node's key. */
  key: string;
  kind: "root" | "folder" | "document";
  /** The folder's or document's name (`""` for the root). */
  label: string;
  /** Names of the folders and documents around it, outermost first. */
  path: string[];
  /** The move there: at the end of that place. */
  move: Move & { kind: "document" };
  /** The document is already there. */
  current: boolean;
};

/**
 * Every place the document `key` can go, in tree order: the root, then each
 * folder and document but itself and its descendants (no cycle).
 */
export function moveDestinations(roots: TreeNode[], key: string): Destination[] {
  const map = locate(roots);
  const moved = map.get(key);
  if (moved?.node.kind !== "document") return [];
  const id = moved.node.document.id;
  const currentKey = moved.parent?.key ?? "root";
  const endOf = (children: TreeNode[]) => children.filter((child) => child.key !== key).length;

  const destinations: Destination[] = [
    {
      key: "root",
      kind: "root",
      label: "",
      path: [],
      move: { kind: "document", id, place: { kind: "root" }, index: endOf(roots) },
      current: currentKey === "root",
    },
  ];
  const walk = (nodes: TreeNode[], path: string[]) => {
    for (const node of nodes) {
      if (node.key === key) continue;
      destinations.push({
        key: node.key,
        kind: node.kind,
        label: nodeName(node),
        path,
        move: { kind: "document", id, place: placeOf(node), index: endOf(node.children) },
        current: currentKey === node.key,
      });
      walk(node.children, [...path, nodeName(node)]);
    }
  };
  walk(roots, []);
  return destinations;
}

function nodeName(node: TreeNode): string {
  return node.kind === "folder" ? node.folder.name : node.document.title;
}

// --- Filters and sort (step 3.8) -------------------------------------------------

/**
 * How the sidebar narrows and orders the tree: kinds of document and card
 * types shown (empty: all; a type stands for its subtypes), sort, and
 * reversed (name: Z to A; date: newest first). Saved per world (3.9).
 */
export type TreeView = Required<SidebarView>;

export const DEFAULT_VIEW: TreeView = {
  kinds: [],
  typeIds: [],
  sort: "manual",
  reversed: false,
  wikiOnly: false,
};

export function isFiltered(view: TreeView): boolean {
  return view.kinds.length > 0 || view.typeIds.length > 0 || view.wikiOnly;
}

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/**
 * The tree as `view` shows it: only the documents matching the filters,
 * with the folders and parents around them (`context` holds those that do
 * not match themselves); each place sorted. `typeIds` must already include
 * the subtypes of each chosen type.
 */
export function viewTree(
  roots: TreeNode[],
  view: TreeView,
): { roots: TreeNode[]; context: ReadonlySet<string> } {
  const filtered = isFiltered(view);
  const kinds = new Set(view.kinds);
  const types = new Set(view.typeIds);
  const matches = (node: TreeNode) =>
    node.kind === "document" &&
    (kinds.size === 0 || kinds.has(node.document.kind)) &&
    (types.size === 0 || (node.document.typeId !== null && types.has(node.document.typeId))) &&
    (!view.wikiOnly || node.document.wikiVisible);
  const context = new Set<string>();

  const order = (a: TreeNode, b: TreeNode): number => {
    // Folders first, by name; then documents.
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    let result = 0;
    if (view.sort === "created" && a.kind === "document" && b.kind === "document") {
      result = a.document.createdAt.localeCompare(b.document.createdAt);
    }
    if (result === 0) {
      const name = (node: TreeNode) =>
        node.kind === "folder" ? node.folder.name : node.document.title;
      result = collator.compare(name(a), name(b));
    }
    return view.reversed ? -result : result;
  };

  const walk = (nodes: TreeNode[]): TreeNode[] => {
    const kept: TreeNode[] = [];
    for (const node of nodes) {
      const children = walk(node.children);
      if (!filtered || matches(node) || children.length > 0) {
        if (filtered && !matches(node)) context.add(node.key);
        kept.push({ ...node, children } as TreeNode);
      }
    }
    return view.sort === "manual" ? kept : kept.sort(order);
  };
  return { roots: walk(roots), context };
}
