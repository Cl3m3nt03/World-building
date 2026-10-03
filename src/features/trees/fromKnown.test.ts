import { describe, expect, it } from "vitest";
import type { KnownRelation, RelationType, VariantContent } from "@/lib/bindings";
import { addKnown, generations, isBlank, knownCards } from "./fromKnown";

const type = (id: string, builtin: string, category: RelationType["category"]): RelationType => ({
  id,
  builtin,
  name: "",
  icon: "users",
  inverseId: null,
  category,
});
const TYPES = [
  type("rel-child", "child", "family"),
  type("rel-parent", "parent", "family"),
  type("rel-spouse", "spouse", "couple"),
  type("rel-sibling", "sibling", "family"),
];
const TYPE_MAP = new Map(TYPES.map((t) => [t.id, t]));

const r = (from: string, to: string, relationTypeId: string | null): KnownRelation => ({
  from,
  to,
  relationTypeId,
});

/** Arathorn and Gilraen, Aragorn their son, Arwen his wife, Eldarion their son. */
const ISILDUR = [
  r("arathorn", "gilraen", "rel-spouse"),
  r("arathorn", "aragorn", "rel-child"),
  r("gilraen", "aragorn", "rel-child"),
  r("aragorn", "arwen", "rel-spouse"),
  r("aragorn", "eldarion", "rel-child"),
  r("arwen", "eldarion", "rel-child"),
];

const BLANK: VariantContent = {
  nodes: [{ id: "blank", cardId: null, label: "", x: 0, y: 0 }],
  edges: [],
  annotations: [],
};

function ids() {
  let next = 0;
  return () => `id${next++}`;
}

const nodeOf = (content: VariantContent, card: string) =>
  content.nodes.find((node) => node.cardId === card);

describe("generations", () => {
  it("puts children below their parents and partners side by side", () => {
    const level = generations(knownCards(ISILDUR), ISILDUR, TYPE_MAP);
    expect(Object.fromEntries(level)).toEqual({
      arathorn: 0,
      gilraen: 0,
      aragorn: 1,
      arwen: 1,
      eldarion: 2,
    });
  });

  it("stops on a loop", () => {
    const loop = [r("a", "b", "rel-child"), r("b", "a", "rel-child")];
    const level = generations(["a", "b"], loop, TYPE_MAP);
    expect(Math.max(...level.values())).toBeLessThanOrEqual(2);
  });
});

describe("addKnown", () => {
  it("fills a blank tree: every card, the couples, children hanging from them", () => {
    const tree = addKnown(BLANK, ISILDUR, TYPES, ids());
    expect(tree.nodes.map((node) => node.cardId).sort()).toEqual(
      ["aragorn", "arathorn", "arwen", "eldarion", "gilraen"].sort(),
    );
    expect(tree.nodes.some((node) => node.id === "blank")).toBe(false);
    const couples = tree.edges.filter((edge) => edge.relationTypeId === "rel-spouse");
    expect(couples).toHaveLength(2);
    const junctions = tree.edges.filter((edge) => edge.source.kind === "edge");
    expect(junctions).toHaveLength(2);
    expect(junctions.every((edge) => edge.relationTypeId === "rel-child")).toBe(true);
    expect(tree.edges).toHaveLength(4);
    // Generations from top to bottom; Eldarion between his parents.
    const at = (card: string) => {
      const node = nodeOf(tree, card);
      return { x: node?.x ?? 0, y: node?.y ?? 0 };
    };
    expect(at("arathorn").y).toBe(at("gilraen").y);
    expect(at("aragorn").y).toBeGreaterThan(at("arathorn").y);
    expect(at("eldarion").y).toBeGreaterThan(at("aragorn").y);
    const between = (at("aragorn").x + at("arwen").x) / 2;
    expect(Math.abs(at("eldarion").x - between)).toBeLessThan(200);
  });

  it("adds only what is missing, beside what is drawn", () => {
    const drawn: VariantContent = {
      nodes: [
        { id: "n-aragorn", cardId: "aragorn", label: "", x: 500, y: 300 },
        { id: "n-arwen", cardId: "arwen", label: "", x: 700, y: 300 },
      ],
      edges: [
        {
          id: "e",
          source: { kind: "node", id: "n-aragorn" },
          target: "n-arwen",
          relationTypeId: "rel-spouse",
          lineStyle: "dashed",
        },
      ],
      annotations: [],
    };
    const tree = addKnown(drawn, ISILDUR, TYPES, ids());
    // Aragorn and Arwen stay, once each, where they were.
    expect(tree.nodes.filter((node) => node.cardId === "aragorn")).toHaveLength(1);
    expect(nodeOf(tree, "aragorn")).toMatchObject({ id: "n-aragorn", x: 500, y: 300 });
    // Their marriage is not drawn twice; Eldarion hangs from it.
    expect(tree.edges.filter((edge) => edge.relationTypeId === "rel-spouse")).toHaveLength(2);
    const eldarion = nodeOf(tree, "eldarion");
    expect(
      tree.edges.some(
        (edge) =>
          edge.target === eldarion?.id && edge.source.kind === "edge" && edge.source.id === "e",
      ),
    ).toBe(true);
    // The new cards go right of the drawing.
    expect((nodeOf(tree, "arathorn")?.x ?? 0) > 700).toBe(true);
  });

  it("leaves a tree that says everything as it is", () => {
    const full = addKnown(BLANK, ISILDUR, TYPES, ids());
    expect(addKnown(full, ISILDUR, TYPES, ids())).toBe(full);
  });

  it("links untyped and other relations node to node", () => {
    const tree = addKnown(BLANK, [r("a", "b", null), r("b", "c", "rel-sibling")], TYPES, ids());
    expect(tree.edges.map((edge) => edge.relationTypeId)).toEqual([null, "rel-sibling"]);
    expect(tree.edges.every((edge) => edge.source.kind === "node")).toBe(true);
  });
});

it("knows a blank tree", () => {
  expect(isBlank(BLANK)).toBe(true);
  expect(isBlank({ ...BLANK, nodes: [{ ...BLANK.nodes[0], label: "Moi" } as never] })).toBe(false);
});
