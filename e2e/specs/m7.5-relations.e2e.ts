/**
 * M7.5 scenarios (docs/roadmap/M7.5-arbres-et-graph.md, ADR 0007):
 * - a link property made a relation (Parents = parent of);
 * - a new tree that starts from the known relations, placed by generation;
 * - « Cité dans » of a card lists that tree;
 * - the graph says why two cards are linked.
 */

import { createCard, createWorld, openCard, openTab, sidebarItem } from "../helpers";

const WORLD = "Dúnedain";

type Invoke = { invoke: (command: string, args?: object) => Promise<unknown> };
const invoke = <T>(command: string, args: object = {}) =>
  browser.execute(
    (c, a) =>
      (window as unknown as { __TAURI_INTERNALS__: Invoke }).__TAURI_INTERNALS__.invoke(c, a),
    command,
    args,
  ) as Promise<T>;

type Content = {
  nodes: { id: string; cardId: string | null; y: number }[];
  edges: { source: { kind: string } }[];
};

describe("M7.5: trees and the graph", () => {
  const cards: Record<string, string> = {};

  it("creates a world where Aragorn has Arathorn and Gilraen as Parents (a relation)", async () => {
    await createWorld(WORLD);
    await openTab("World");
    for (const name of ["Arathorn", "Gilraen", "Aragorn"]) await createCard("Personnage", name);
    for (const card of await invoke<{ id: string; title: string }[]>("list_cards", {
      trashed: false,
    })) {
      cards[card.title] = card.id;
    }
    let property = await invoke<{ id: string }>("create_property", {
      owner: { on: "card", cardId: cards.Aragorn },
      label: "Parents",
      kind: "text",
    });
    property = await invoke("set_property_kind", {
      id: property.id,
      kind: "cards",
      targetTypeIds: [],
    });
    await invoke("set_property_relation", { id: property.id, relationTypeId: "rel-parent" });
    await invoke("set_property_value", {
      cardId: cards.Aragorn,
      propertyId: property.id,
      value: { kind: "cards", value: [cards.Arathorn, cards.Gilraen] },
    });
    const known = await invoke<unknown[]>("known_relations");
    expect(known).toHaveLength(2);
  });

  it("starts a new tree from the known relations, parents above their son", async () => {
    await $("aria/Nouveau document (map, graph, arbre, canvas…)").click();
    await $('//*[@role="menuitem"][normalize-space()="Nouvel arbre"]').click();
    const offer = await $('section[aria-label="Partir de ce que le monde sait ?"]');
    await offer.waitForDisplayed({
      timeoutMsg: "the blank tree did not offer the known relations",
    });
    await offer.$("button=Reprendre ces relations").click();
    await browser.waitUntil(
      async () => {
        const tree = await invoke<{ id: string; title: string }[]>("document_tree").then(
          (t) => (t as unknown as { documents: { id: string; kind: string }[] }).documents,
        );
        const id = tree.find((d) => d.kind === "tree")?.id;
        if (!id) return false;
        const saved = await invoke<{ variants: { content: Content }[] }>("get_tree", { id });
        return saved.variants[0]?.content.nodes.length === 3;
      },
      { timeoutMsg: "the tree did not take the three cards" },
    );
    const tree = (
      await invoke<{ documents: { id: string; kind: string }[] }>("document_tree")
    ).documents.find((d) => d.kind === "tree");
    const content = (
      await invoke<{ variants: { content: Content }[] }>("get_tree", { id: tree?.id })
    ).variants[0]?.content as Content;
    const y = (card: string) => content.nodes.find((node) => node.cardId === cards[card])?.y ?? 0;
    expect(y("Arathorn")).toBe(y("Gilraen"));
    expect(y("Aragorn")).toBeGreaterThan(y("Arathorn"));
    expect(content.edges).toHaveLength(2);
  });

  it("lists the tree in « Cité dans » of Arathorn", async () => {
    await openCard("Arathorn");
    const cited = await $('section[aria-label="Cité dans"]');
    await cited
      .$("*=Arbre sans nom")
      .waitForDisplayed({ timeoutMsg: "the tree is not in « Cité dans »" });
  });

  it("says in the graph why Aragorn and Arathorn are linked", async () => {
    await $("aria/Nouveau document (map, graph, arbre, canvas…)").click();
    await $('//*[@role="menuitem"][normalize-space()="Nouveau graph"]').click();
    const list = await $('[role="listbox"]');
    await list.waitForDisplayed();
    await list.$('//*[@role="option"][normalize-space()="Aragorn"]').click();
    const linked = await $('section[aria-label="Cartes liées à Aragorn"]');
    await browser.waitUntil(
      async () =>
        (await linked.getText()).includes("Arathorn : parent de Aragorn — propriété « Parents »"),
      { timeoutMsg: "the property relation is not said" },
    );
    expect(await linked.getText()).toContain("arbre « Arbre sans nom »");
    expect(await sidebarItem("Arbre sans nom").isExisting()).toBe(true);
  });
});
