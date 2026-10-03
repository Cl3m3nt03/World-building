/**
 * M6 scenarios (docs/roadmap/M6-relation-tree.md, 6.11), the acceptance
 * criteria of docs/features/05-relation-tree.md:
 * - three generations built with the « + » only;
 * - a junction: a child hanging from the link between their parents;
 * - a link drawn between two nodes, then reconnected to another;
 * - an annotation written over the tree;
 * - two variants edited on their own;
 * - all of it the same after reopening the world.
 */

import { createWorld, currentWorldButton, openTab, sidebarItem } from "../helpers";

const WORLD = "Arnor";
const TREE = "Arbre sans nom";

type Content = {
  nodes: { id: string; label: string }[];
  edges: {
    id: string;
    source: { kind: "node" | "edge"; id: string };
    target: string;
    relationTypeId: string | null;
  }[];
  annotations: { kind: string; text?: string }[];
};

/** The tree's variants as saved by the Rust side. */
const saved = () =>
  browser.execute(async (title) => {
    const internals = (
      window as unknown as {
        __TAURI_INTERNALS__: { invoke: (command: string, args?: object) => Promise<unknown> };
      }
    ).__TAURI_INTERNALS__;
    const tree = (await internals.invoke("document_tree")) as {
      documents: { id: string; title: string }[];
    };
    const document = tree.documents.find((candidate) => candidate.title === title);
    if (!document) return null;
    return (await internals.invoke("get_tree", { id: document.id })) as {
      variants: { name: string; content: Content }[];
    };
  }, TREE);

/** The first variant's content, once saved (the editor waits a little). */
async function first(): Promise<Content> {
  await browser.pause(1200);
  const tree = await saved();
  if (!tree?.variants[0]) throw new Error("the tree was not saved");
  return tree.variants[0].content;
}

const idOf = (content: Content, label: string) =>
  content.nodes.find((node) => node.label === label)?.id ?? "";

/** A node of the tree, by its name. */
const node = (name: string) =>
  $(`//div[contains(@class,"react-flow__node-person")][.//span[normalize-space()="${name}"]]`);

/** The centre of an element, in the window. */
async function centre(element: ReturnType<typeof $> | WebdriverIO.Element) {
  const found = (await element) as WebdriverIO.Element;
  const { x, y } = await found.getLocation();
  const { width, height } = await found.getSize();
  return { x: Math.round(x + width / 2), y: Math.round(y + height / 2) };
}

/** Drags with the mouse from one point to another, in steps. */
async function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
  await browser
    .action("pointer", { parameters: { pointerType: "mouse" } })
    .move({ x: from.x, y: from.y, origin: "viewport" })
    .down({ button: 0 })
    .move({ x: Math.round((from.x + to.x) / 2), y: Math.round((from.y + to.y) / 2), duration: 150 })
    .move({ x: to.x, y: to.y, duration: 150 })
    .up({ button: 0 })
    .perform();
}

/** A node's attach point (where links are drawn from), on side `side`. */
const handle = (name: string, side: "top" | "right" | "bottom" | "left") =>
  node(name).$(`.react-flow__handle-${side}.source`);

/** A click in a corner of the tree's background: nothing stays selected. */
async function clickPane() {
  const pane = await $(".react-flow__pane");
  const { width, height } = await pane.getSize();
  // WebdriverIO's offsets start from the element's centre.
  await pane.click({ x: -Math.floor(width / 2) + 12, y: -Math.floor(height / 2) + 12 });
  await browser.pause(200);
}

/** « Recentrer »: the whole tree in the view. */
async function recenter() {
  await $(
    `//*[@role="toolbar"][@aria-label="Outils de l'arbre"]//button[normalize-space()="Recentrer"]`,
  ).click();
  await browser.pause(400);
}

/** Names the empty node whose search is open. */
async function name(label: string) {
  // Its popover fades in: on the CI runner it may stay at opacity 0 for
  // WebdriverIO's « displayed »; what matters is that it is there, focused.
  await $('input[aria-label="Carte ou nom du nœud"]').waitForExist();
  // Keys typed before the field has the focus would be lost (it opens while
  // the view moves to the new node).
  await browser.waitUntil(
    async () =>
      browser.execute(
        () => document.activeElement?.getAttribute("aria-label") === "Carte ou nom du nœud",
      ),
    { timeoutMsg: "the node search never got the focus" },
  );
  await browser.keys(label);
  await $(`//*[@role="option"][normalize-space()="Utiliser le nom « ${label} »"]`).waitForExist();
  await $(`//*[@role="option"][normalize-space()="Utiliser le nom « ${label} »"]`).click();
  await node(label).waitForDisplayed();
}

/** Selects `from`, opens its « + » on `side`, picks `relation`, names the new node. */
async function relative(from: string, side: string, relation: string, label: string) {
  // In a small window, the view may have followed the last node added away
  // from `from`: show the whole tree first, as a person would.
  await recenter();
  await node(from).click();
  await $(`aria/Ajouter une relation ${side} ${from}`).click();
  await $(`//*[@role="menuitem"][normalize-space()="${relation}"]`).click();
  await name(label);
}

describe("M6: the relation tree", () => {
  it("builds three generations with the « + » only", async () => {
    await createWorld(WORLD);
    await openTab("World");
    await $("aria/Nouveau document (map, graph, arbre…)").click();
    await $('//*[@role="menuitem"][normalize-space()="Nouvel arbre"]').click();
    // A click while the menu is still closing would only close it.
    await browser.waitUntil(async () => !(await $('[role="menu"]').isExisting()), {
      timeoutMsg: "the « Nouveau document » menu did not close",
    });
    await $("span=Nouveau personnage").click();
    await name("Aragorn");

    await relative("Aragorn", "au-dessus de", "Parent", "Arathorn");
    await relative("Arathorn", "à droite de", "Époux·se", "Gilraen");
    await relative("Aragorn", "en dessous de", "Enfant", "Eldarion");

    const content = await first();
    expect(content.nodes.map((n) => n.label).sort()).toEqual([
      "Aragorn",
      "Arathorn",
      "Eldarion",
      "Gilraen",
    ]);
    expect(content.edges.map((e) => e.relationTypeId).sort()).toEqual([
      "rel-child",
      "rel-parent",
      "rel-spouse",
    ]);
  });

  it("hangs a child from the link between their parents (a junction)", async () => {
    const before = await first();
    const couple = before.edges.find((e) => e.relationTypeId === "rel-spouse");
    if (!couple) throw new Error("no couple link");
    await recenter();
    await clickPane();
    const point = await $(`.react-flow__node-junction[data-id="junction:${couple.id}"]`);
    await drag(await centre(point), await centre(await handle("Aragorn", "top")));
    await $('//*[@role="menuitem"][normalize-space()="Enfant"]').click();

    const after = await first();
    const junction = after.edges.find((e) => e.source.kind === "edge");
    expect(junction?.source.id).toBe(couple.id);
    expect(junction?.target).toBe(idOf(after, "Aragorn"));
    expect(junction?.relationTypeId).toBe("rel-child");
  });

  it("draws a link between two nodes and reconnects it to another", async () => {
    await clickPane();
    await recenter();
    await node("Eldarion").moveTo();
    await drag(
      await centre(await handle("Eldarion", "right")),
      await centre(await handle("Gilraen", "bottom")),
    );
    await $(`//*[@role="menuitem"][normalize-space()="Passer pour l'instant"]`).click();
    let content = await first();
    const drawn = content.edges.find(
      (e) => e.source.id === idOf(content, "Eldarion") && e.target === idOf(content, "Gilraen"),
    );
    if (!drawn) throw new Error(`no link drawn: ${JSON.stringify(content.edges)}`);
    expect(drawn.relationTypeId).toBeNull();

    // Selected (it is, once drawn), its end moves to Arathorn.
    await $('//*[@role="toolbar"][starts-with(@aria-label, "Lien ")]').waitForDisplayed();
    const end = await $(".react-flow__edge.selected .react-flow__edgeupdater-target");
    await drag(await centre(end), await centre(await handle("Arathorn", "bottom")));
    content = await first();
    const moved = content.edges.find((e) => e.id === drawn.id);
    expect(moved?.target).toBe(idOf(content, "Arathorn"));
    expect(moved?.source.id).toBe(idOf(content, "Eldarion"));
  });

  it("writes a text over the tree", async () => {
    await clickPane();
    await $(
      '//*[@role="toolbar"][@aria-label="Outils de l\'arbre"]//button[@aria-label="Texte"]',
    ).click();
    const pane = await $(".react-flow__pane");
    const { x, y } = await pane.getLocation();
    await browser
      .action("pointer", { parameters: { pointerType: "mouse" } })
      .move({ x: Math.round(x + 60), y: Math.round(y + 60), origin: "viewport" })
      .down({ button: 0 })
      .up({ button: 0 })
      .perform();
    await $("aria/Texte libre").waitForDisplayed();
    await browser.keys(["G", "o", "n", "d", "o", "r", "Enter"]);
    const content = await first();
    expect(content.annotations).toEqual([
      expect.objectContaining({ kind: "text", text: "Gondor" }),
    ]);
    await $(
      '//*[@role="toolbar"][@aria-label="Outils de l\'arbre"]//button[@aria-label="Sélection"]',
    ).click();
  });

  it("edits two variants on their own", async () => {
    await $("button=Ajouter une variante").click();
    const field = await $("aria/Nom de la nouvelle variante");
    await field.waitForDisplayed();
    await browser.keys("Enter");
    await $('//*[@role="tab"][normalize-space()="Variante 2"]').waitForDisplayed();
    await $("button=Ajouter un nœud").click();
    await name("Faramir");

    await $('//*[@role="tab"][normalize-space()="Variante 1"]').click();
    await browser.waitUntil(async () => !(await node("Faramir").isExisting()), {
      timeoutMsg: "Faramir shows in Variante 1",
    });
    await browser.pause(1200);
    const tree = await saved();
    expect(tree?.variants.map((v) => v.name)).toEqual(["Variante 1", "Variante 2"]);
    expect(tree?.variants[0]?.content.nodes.some((n) => n.label === "Faramir")).toBe(false);
    expect(tree?.variants[1]?.content.nodes.some((n) => n.label === "Faramir")).toBe(true);
  });

  it("is the same after reopening the world", async () => {
    await browser.pause(1200);
    const before = JSON.stringify(await saved());
    await $("button=Mondes").click();
    await $("h1=Mondes").waitForDisplayed();
    await $(`aria/Ouvrir ${WORLD}`).click();
    await currentWorldButton(WORLD).waitForDisplayed();
    await openTab("World");
    await sidebarItem(TREE).click();
    await node("Eldarion").waitForDisplayed();
    expect(JSON.stringify(await saved())).toBe(before);
    expect(await $$(".react-flow__edge").length).toBe(5);
    await $("aria/Texte « Gondor »").waitForExist();
  });
});
