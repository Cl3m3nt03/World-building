import type { DocumentTree, Folder, TreeDocument } from "@/lib/bindings";

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
