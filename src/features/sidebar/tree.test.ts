import { describe, expect, it } from "vitest";
import type { DocumentTree, Folder, TreeDocument } from "@/lib/bindings";
import {
  ancestorKeys,
  applyMove,
  applyPinMove,
  applyPinned,
  buildTree,
  DEFAULT_VIEW,
  dropMove,
  moveDestinations,
  pinnedDocuments,
  type TreeNode,
  type TreeView,
  viewTree,
  visibleRows,
} from "./tree";

function folder(id: string, sortOrder: number, parentId: string | null = null): Folder {
  return { id, parentId, name: id, icon: "folder", sortOrder };
}

function doc(
  id: string,
  sortOrder: number,
  place: { folderId?: string; parentId?: string } = {},
): TreeDocument {
  return {
    id,
    kind: "card",
    title: id,
    folderId: place.folderId ?? null,
    parentId: place.parentId ?? null,
    sortOrder,
    pinnedOrder: null,
    createdAt: "2026-10-01T00:00:00Z",
    typeId: "character",
    imageAssetId: null,
    wikiVisible: false,
  };
}

/** The tree as indented names, to compare whole shapes at once. */
function outline(nodes: TreeNode[], depth = 0): string[] {
  return nodes.flatMap((node) => [
    `${"  ".repeat(depth)}${node.key}`,
    ...outline(node.children, depth + 1),
  ]);
}

// Root: [Places (folder), Arya, Lore (folder)]; Places holds [Winterfell
// (with child Crypt), North (folder, holding Wall)].
const sample: DocumentTree = {
  folders: [folder("lore", 2), folder("places", 0), folder("north", 1, "places")],
  documents: [
    doc("crypt", 0, { parentId: "winterfell" }),
    doc("arya", 1),
    doc("wall", 0, { folderId: "north" }),
    doc("winterfell", 0, { folderId: "places" }),
  ],
};

describe("buildTree", () => {
  it("nests folders, documents and children, each place in its order", () => {
    expect(outline(buildTree(sample))).toEqual([
      "f:places",
      "  d:winterfell",
      "    d:crypt",
      "  f:north",
      "    d:wall",
      "d:arya",
      "f:lore",
    ]);
  });

  it("shows at the root a document whose place is missing", () => {
    const tree = { folders: [], documents: [doc("lost", 0, { folderId: "gone" }), doc("a", 1)] };
    expect(outline(buildTree(tree))).toEqual(["d:lost", "d:a"]);
  });

  it("is empty for an empty world", () => {
    expect(buildTree({ folders: [], documents: [] })).toEqual([]);
  });
});

describe("visibleRows", () => {
  const roots = buildTree(sample);
  const keys = (expanded: string[]) =>
    visibleRows(roots, new Set(expanded)).map((row) => row.node.key);

  it("shows only the root when nothing is open", () => {
    expect(keys([])).toEqual(["f:places", "d:arya", "f:lore"]);
  });

  it("shows the content of open nodes only", () => {
    expect(keys(["f:places"])).toEqual(["f:places", "d:winterfell", "f:north", "d:arya", "f:lore"]);
    // An open node inside a closed one stays hidden.
    expect(keys(["d:winterfell"])).toEqual(["f:places", "d:arya", "f:lore"]);
    expect(keys(["f:places", "d:winterfell", "f:north"])).toEqual([
      "f:places",
      "d:winterfell",
      "d:crypt",
      "f:north",
      "d:wall",
      "d:arya",
      "f:lore",
    ]);
  });

  it("gives each row its level, position, siblings and parent", () => {
    const rows = visibleRows(roots, new Set(["f:places", "d:winterfell"]));
    const describe = rows.map(
      (r) => `${r.node.key} ${r.level} ${r.position}/${r.siblings} ${r.parentKey}`,
    );
    expect(describe).toEqual([
      "f:places 1 1/3 null",
      "d:winterfell 2 1/2 f:places",
      "d:crypt 3 1/1 d:winterfell",
      "f:north 2 2/2 f:places",
      "d:arya 1 2/3 null",
      "f:lore 1 3/3 null",
    ]);
  });
});

describe("ancestorKeys", () => {
  it("lists the enclosing nodes, outermost first", () => {
    expect(ancestorKeys(sample, "crypt")).toEqual(["f:places", "d:winterfell"]);
    expect(ancestorKeys(sample, "wall")).toEqual(["f:places", "f:north"]);
    expect(ancestorKeys(sample, "arya")).toEqual([]);
    expect(ancestorKeys(sample, "unknown")).toEqual([]);
  });

  it("stops on a cycle instead of looping", () => {
    const tree = {
      folders: [],
      documents: [doc("a", 0, { parentId: "b" }), doc("b", 0, { parentId: "a" })],
    };
    expect(ancestorKeys(tree, "a")).toEqual(["d:a", "d:b"]);
  });
});

describe("dropMove", () => {
  const roots = buildTree(sample);

  it("moves a document before or after a row, in that row's place", () => {
    expect(dropMove(roots, "d:arya", "f:places", "before")).toEqual({
      kind: "document",
      id: "arya",
      place: { kind: "root" },
      index: 0,
    });
    // Index counted without the moved row: after Lore is the end of [Places, Lore].
    expect(dropMove(roots, "d:arya", "f:lore", "after")).toEqual({
      kind: "document",
      id: "arya",
      place: { kind: "root" },
      index: 2,
    });
    expect(dropMove(roots, "d:arya", "d:crypt", "after")).toEqual({
      kind: "document",
      id: "arya",
      place: { kind: "parent", id: "winterfell" },
      index: 1,
    });
  });

  it("files into a folder, or under a document, at the end", () => {
    expect(dropMove(roots, "d:arya", "f:north", "inside")).toEqual({
      kind: "document",
      id: "arya",
      place: { kind: "folder", id: "north" },
      index: 1,
    });
    expect(dropMove(roots, "d:wall", "d:winterfell", "inside")).toEqual({
      kind: "document",
      id: "wall",
      place: { kind: "parent", id: "winterfell" },
      index: 1,
    });
  });

  it("moves folders among folders and documents, never under a document", () => {
    expect(dropMove(roots, "f:lore", "f:north", "inside")).toEqual({
      kind: "folder",
      id: "lore",
      parentId: "north",
      index: 1,
    });
    expect(dropMove(roots, "f:north", "d:arya", "after")).toEqual({
      kind: "folder",
      id: "north",
      parentId: null,
      index: 2,
    });
    expect(dropMove(roots, "f:lore", "d:winterfell", "inside")).toBe("refused");
    expect(dropMove(roots, "f:lore", "d:crypt", "before")).toBe("refused");
  });

  it("refuses a drop into itself or one of its descendants", () => {
    expect(dropMove(roots, "f:places", "f:north", "inside")).toBe("refused");
    expect(dropMove(roots, "f:places", "d:wall", "before")).toBe("refused");
    expect(dropMove(roots, "d:winterfell", "d:crypt", "inside")).toBe("refused");
  });

  it("does nothing when the row stays where it is", () => {
    expect(dropMove(roots, "d:arya", "d:arya", "inside")).toBeNull();
    expect(dropMove(roots, "d:arya", "f:places", "after")).toBeNull();
    expect(dropMove(roots, "d:arya", "f:lore", "before")).toBeNull();
    expect(dropMove(roots, "d:crypt", "d:winterfell", "inside")).toBeNull();
  });
});

describe("applyMove", () => {
  const moved = (move: Parameters<typeof applyMove>[1]) =>
    outline(buildTree(applyMove(sample, move)));

  it("moves a document between places and renumbers both", () => {
    const tree = applyMove(sample, {
      kind: "document",
      id: "crypt",
      place: { kind: "root" },
      index: 0,
    });
    expect(outline(buildTree(tree))).toEqual([
      "d:crypt",
      "f:places",
      "  d:winterfell",
      "  f:north",
      "    d:wall",
      "d:arya",
      "f:lore",
    ]);
    const root = [
      ...tree.folders.filter((f) => f.parentId === null),
      ...tree.documents.filter((d) => d.parentId === null && d.folderId === null),
    ];
    expect(root.map((entry) => entry.sortOrder).sort()).toEqual([0, 1, 2, 3]);
  });

  it("reorders inside one place and moves folders", () => {
    expect(moved({ kind: "document", id: "arya", place: { kind: "root" }, index: 2 })).toEqual([
      "f:places",
      "  d:winterfell",
      "    d:crypt",
      "  f:north",
      "    d:wall",
      "f:lore",
      "d:arya",
    ]);
    expect(moved({ kind: "folder", id: "north", parentId: null, index: 0 })).toEqual([
      "f:north",
      "  d:wall",
      "f:places",
      "  d:winterfell",
      "    d:crypt",
      "d:arya",
      "f:lore",
    ]);
  });

  it("leaves the given tree untouched", () => {
    const copy = structuredClone(sample);
    applyMove(sample, { kind: "document", id: "wall", place: { kind: "root" }, index: 0 });
    expect(sample).toEqual(copy);
  });
});

describe("pins", () => {
  const pinnedSample: DocumentTree = {
    folders: [],
    documents: [
      { ...doc("a", 0), pinnedOrder: 1 },
      { ...doc("b", 1), pinnedOrder: 0 },
      doc("c", 2),
    ],
  };
  const ids = (tree: DocumentTree) => pinnedDocuments(tree).map((d) => d.id);

  it("lists the pins in their order", () => {
    expect(ids(pinnedSample)).toEqual(["b", "a"]);
  });

  it("pins at the end and unpins closing the gap", () => {
    expect(ids(applyPinned(pinnedSample, "c", true))).toEqual(["b", "a", "c"]);
    const unpinned = applyPinned(pinnedSample, "b", false);
    expect(ids(unpinned)).toEqual(["a"]);
    expect(unpinned.documents.find((d) => d.id === "a")?.pinnedOrder).toBe(0);
    expect(applyPinned(pinnedSample, "a", true)).toBe(pinnedSample);
  });

  it("moves a pin, counting the index without it", () => {
    const tree = applyPinned(pinnedSample, "c", true);
    expect(ids(applyPinMove(tree, "c", 0))).toEqual(["c", "b", "a"]);
    expect(ids(applyPinMove(tree, "b", 9))).toEqual(["a", "c", "b"]);
    expect(applyPinMove(tree, "zzz", 0)).toBe(tree);
  });
});

describe("moveDestinations", () => {
  const roots = buildTree(sample);
  const show = (key: string) =>
    moveDestinations(roots, key).map(
      (d) =>
        `${[...d.path, d.label || "/"].join(" › ")} ${d.move.place.kind}:${"id" in d.move.place ? d.move.place.id : ""}@${d.move.index}${d.current ? " (here)" : ""}`,
    );

  it("offers the root, folders and documents, at the end of each", () => {
    expect(show("d:arya")).toEqual([
      "/ root:@2 (here)",
      "places folder:places@2",
      "places › winterfell parent:winterfell@1",
      "places › winterfell › crypt parent:crypt@0",
      "places › north folder:north@1",
      "places › north › wall parent:wall@0",
      "lore folder:lore@0",
    ]);
  });

  it("never offers the document itself or its descendants", () => {
    const keys = moveDestinations(roots, "d:winterfell").map((d) => d.key);
    expect(keys).not.toContain("d:winterfell");
    expect(keys).not.toContain("d:crypt");
    expect(moveDestinations(roots, "d:winterfell").find((d) => d.current)?.key).toBe("f:places");
  });

  it("is empty for a folder or an unknown key", () => {
    expect(moveDestinations(roots, "f:places")).toEqual([]);
    expect(moveDestinations(roots, "d:nope")).toEqual([]);
  });
});

describe("viewTree", () => {
  // Root: [Zeta (character), Places (folder) > [Winterfell (place) > [Crypt (place)], Arya (character)], Bran (character)]
  const typed = (id: string, order: number, typeId: string, createdAt: string, place = {}) => ({
    ...doc(id, order, place),
    typeId,
    createdAt,
  });
  const world: DocumentTree = {
    folders: [folder("places", 1)],
    documents: [
      typed("zeta", 0, "character", "2026-01-03"),
      typed("winterfell", 0, "place", "2026-01-01", { folderId: "places" }),
      typed("crypt", 0, "place", "2026-01-05", { parentId: "winterfell" }),
      typed("arya", 1, "character", "2026-01-04", { folderId: "places" }),
      typed("bran", 2, "character", "2026-01-02"),
    ],
  };
  const roots = buildTree(world);
  const show = (view: Partial<TreeView>) => {
    const result = viewTree(roots, { ...DEFAULT_VIEW, ...view });
    return outline(result.roots).map((line) =>
      result.context.has(line.trim()) ? `${line} (context)` : line,
    );
  };

  it("keeps the tree as it is by default", () => {
    expect(show({})).toEqual(outline(roots));
  });

  it("filters by card type, keeping folders and parents around the matches", () => {
    expect(show({ typeIds: ["character"] })).toEqual([
      "d:zeta",
      "f:places (context)",
      "  d:arya",
      "d:bran",
    ]);
    expect(show({ typeIds: ["place"] })).toEqual([
      "f:places (context)",
      "  d:winterfell",
      "    d:crypt",
    ]);
    expect(show({ kinds: ["map"] })).toEqual([]);
  });

  it("keeps only the documents visible in the wiki when asked", () => {
    const shown = buildTree({
      ...world,
      documents: world.documents.map((d) => (d.id === "bran" ? { ...d, wikiVisible: true } : d)),
    });
    const result = viewTree(shown, { ...DEFAULT_VIEW, wikiOnly: true });
    expect(outline(result.roots)).toEqual(["d:bran"]);
  });

  it("sorts by name or by creation date, folders first, and reverses", () => {
    expect(show({ sort: "name" })).toEqual([
      "f:places",
      "  d:arya",
      "  d:winterfell",
      "    d:crypt",
      "d:bran",
      "d:zeta",
    ]);
    expect(show({ sort: "name", reversed: true })).toEqual([
      "f:places",
      "  d:winterfell",
      "    d:crypt",
      "  d:arya",
      "d:zeta",
      "d:bran",
    ]);
    expect(show({ sort: "created", typeIds: ["character"] })).toEqual([
      "f:places (context)",
      "  d:arya",
      "d:bran",
      "d:zeta",
    ]);
    expect(show({ sort: "created", reversed: true, typeIds: ["character"] })).toEqual([
      "f:places (context)",
      "  d:arya",
      "d:zeta",
      "d:bran",
    ]);
  });

  it("leaves the tree untouched", () => {
    const before = outline(roots);
    viewTree(roots, { ...DEFAULT_VIEW, sort: "name", typeIds: ["place"] });
    expect(outline(roots)).toEqual(before);
  });
});
