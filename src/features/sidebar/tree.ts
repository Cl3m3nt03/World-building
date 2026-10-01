import type { DocumentTree, Folder, Place, TreeDocument } from "@/lib/bindings";

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
