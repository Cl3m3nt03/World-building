import { expect, test } from "vitest";
import type { TreeEdge, VariantContent } from "@/lib/bindings";
import {
  addNode,
  addRelative,
  connect,
  fillNode,
  moveNodes,
  newNode,
  reconnectEdge,
  removeEdge,
  removeNode,
  reverseEdge,
  updateEdge,
} from "./content";

function edge(id: string, source: TreeEdge["source"], target: string): TreeEdge {
  return { id, source, target, relationTypeId: null, lineStyle: "solid" };
}

const FAMILY: VariantContent = {
  nodes: ["arathorn", "gilraen", "aragorn", "arwen", "eldarion"].map((id) => ({
    id,
    cardId: null,
    label: id,
    x: 0,
    y: 0,
  })),
  edges: [
    edge("couple", { kind: "node", id: "arathorn" }, "gilraen"),
    // Aragorn hangs from his parents' link (a junction).
    edge("child", { kind: "edge", id: "couple" }, "aragorn"),
    edge("couple2", { kind: "node", id: "aragorn" }, "arwen"),
    edge("child2", { kind: "edge", id: "couple2" }, "eldarion"),
  ],
  annotations: [],
};

test("removing a node takes its links and every junction hanging from them", () => {
  const after = removeNode(FAMILY, "arathorn");
  expect(after.nodes.map((node) => node.id)).toEqual(["gilraen", "aragorn", "arwen", "eldarion"]);
  // « couple » goes with Arathorn, « child » hung from it; Aragorn's own family stays.
  expect(after.edges.map((e) => e.id)).toEqual(["couple2", "child2"]);

  const deeper = removeNode(FAMILY, "aragorn");
  expect(deeper.edges.map((e) => e.id)).toEqual(["couple"]);
});

test("filling a node sets its card or its plain name, never both", () => {
  const named = fillNode(FAMILY, "arwen", { label: "  Undómiel " });
  expect(named.nodes[3]).toMatchObject({ cardId: null, label: "Undómiel" });
  const carded = fillNode(named, "arwen", { cardId: "card-arwen" });
  expect(carded.nodes[3]).toMatchObject({ cardId: "card-arwen", label: "" });
});

test("a new node is empty and added last; moving keeps the others in place", () => {
  const node = newNode(10, 20);
  const after = addNode(FAMILY, node);
  expect(after.nodes.at(-1)).toEqual({ id: node.id, cardId: null, label: "", x: 10, y: 20 });
  const moved = moveNodes(after, new Map([[node.id, { x: 5, y: 6 }]]));
  expect(moved.nodes.at(-1)).toMatchObject({ x: 5, y: 6 });
  expect(moved.nodes[0]).toBe(after.nodes[0]);
});

test("a relative goes on its side, sliding along it while the place is taken", () => {
  const one: VariantContent = {
    nodes: [{ id: "a", cardId: null, label: "A", x: 0, y: 0 }],
    edges: [],
    annotations: [],
  };
  const first = addRelative(one, "a", "bottom", "rel-child");
  const child = first.content.nodes[1];
  expect(child?.x).toBe(0);
  expect((child?.y ?? 0) > 120).toBe(true);
  expect(first.content.edges[0]).toMatchObject({
    source: { kind: "node", id: "a" },
    target: first.nodeId,
    relationTypeId: "rel-child",
  });
  // A second child does not cover the first: it slides along the row.
  const second = addRelative(first.content, "a", "bottom", "rel-child");
  const other = second.content.nodes[2];
  expect(other?.y).toBe(child?.y);
  expect(Math.abs((other?.x ?? 0) - (child?.x ?? 0)) >= 96).toBe(true);
  // An unknown node changes nothing.
  expect(addRelative(one, "nobody", "top", null)).toEqual({ content: one, nodeId: null });
});

test("removing a link takes the junctions hanging from it, not the nodes", () => {
  const after = removeEdge(FAMILY, "couple");
  expect(after.edges.map((e) => e.id)).toEqual(["couple2", "child2"]);
  expect(after.nodes).toHaveLength(5);
});

test("connecting two nodes adds a link without a type, once, never a loop", () => {
  const { content, edgeId } = connect(FAMILY, "gilraen", "arwen");
  expect(content.edges.at(-1)).toEqual({
    id: edgeId,
    source: { kind: "node", id: "gilraen" },
    target: "arwen",
    relationTypeId: null,
    lineStyle: "solid",
  });
  expect(connect(content, "gilraen", "arwen").edgeId).toBeNull();
  expect(connect(FAMILY, "arwen", "arwen").edgeId).toBeNull();
  expect(connect(FAMILY, "arwen", "nobody").edgeId).toBeNull();
});

test("a link's end moves to another node; turning it round swaps its ends", () => {
  const moved = reconnectEdge(FAMILY, "couple", "target", "arwen");
  expect(moved.edges[0]).toMatchObject({ source: { id: "arathorn" }, target: "arwen" });
  const start = reconnectEdge(FAMILY, "couple", "source", "eldarion");
  expect(start.edges[0]).toMatchObject({ source: { id: "eldarion" }, target: "gilraen" });
  // Never onto its own other end; a junction keeps the link it starts from.
  expect(reconnectEdge(FAMILY, "couple", "target", "arathorn")).toEqual(FAMILY);
  expect(reconnectEdge(FAMILY, "child", "source", "arwen").edges[1]).toEqual(FAMILY.edges[1]);

  const reversed = reverseEdge(FAMILY, "couple");
  expect(reversed.edges[0]).toMatchObject({
    source: { kind: "node", id: "gilraen" },
    target: "arathorn",
  });
  expect(reverseEdge(FAMILY, "child")).toEqual(FAMILY);

  const styled = updateEdge(FAMILY, "couple", {
    lineStyle: "dotted",
    relationTypeId: "rel-spouse",
  });
  expect(styled.edges[0]).toMatchObject({ lineStyle: "dotted", relationTypeId: "rel-spouse" });
});
