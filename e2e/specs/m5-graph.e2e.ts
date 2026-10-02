/**
 * M5 scenarios (docs/roadmap/M5-graph.md, 5.10), the acceptance criteria of
 * docs/features/04-graph.md:
 * - a mention in a card's text gives an edge in the graph;
 * - a filter on « Personnage » keeps the characters only;
 * - the search finds a card by an alias;
 * - a pinned node does not move when the repulsion changes;
 * - a configuration saved under a name reopens the same, after reopening
 *   the world.
 */

import { createCard, createWorld, currentWorldButton, openCard, openTab } from "../helpers";

const WORLD = "Doriath";

/** Accessible name of the drawing: « Graph <name> : N cartes, M liens ». */
const drawing = () => $('//canvas[@role="img"]');

/** Name of the list of the shown cards (« 3 cartes »). */
const listTitle = () =>
  browser.execute(() => document.getElementById("graph-nodes-title")?.textContent ?? "");

/** Configuration of the graph `title`, as saved by the Rust side. */
const savedConfig = (title: string) =>
  browser.execute(async (name) => {
    const internals = (
      window as unknown as {
        __TAURI_INTERNALS__: { invoke: (command: string, args?: object) => Promise<unknown> };
      }
    ).__TAURI_INTERNALS__;
    const tree = (await internals.invoke("document_tree")) as {
      documents: { id: string; title: string }[];
    };
    const document = tree.documents.find((candidate) => candidate.title === name);
    if (!document) return null;
    const graph = (await internals.invoke("get_graph", { id: document.id })) as { config: unknown };
    return JSON.stringify(graph.config);
  }, title);

/** Picks `entry` of the « Nouveau document » menu of the sidebar. */
async function newDocument(entry: string) {
  await $("aria/Nouveau document (map, graph, arbre…)").click();
  await $(`//*[@role="menuitem"][normalize-space()="${entry}"]`).click();
}

/** Sets the range input labelled `label` to `value`. */
async function setRange(label: string, value: number) {
  const input = await $(
    `//label[starts-with(normalize-space(), "${label}")]/following-sibling::input[@type="range"]`,
  );
  await browser.execute(
    (element, next) => {
      const range = element as unknown as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(range, String(next));
      range.dispatchEvent(new Event("input", { bubbles: true }));
    },
    input,
    value,
  );
}

/** The card shown at the centre of the drawing, found by a click there. */
async function cardAtCentre(): Promise<string | null> {
  const canvas = await drawing();
  // A click in a corner clears the selection, one at the centre selects.
  await canvas.click({ x: -Math.floor((await canvas.getSize("width")) / 2) + 5, y: 0 });
  await canvas.click();
  await browser.pause(200);
  return browser.execute(
    () =>
      document.querySelector('[role="option"][aria-selected="true"] span.truncate')?.textContent ??
      null,
  );
}

describe("M5: the graph", () => {
  it("draws a mention between two cards as an edge", async () => {
    await createWorld(WORLD);
    await openTab("World");
    for (const [type, title] of [
      ["Personnage", "Arwen"],
      ["Personnage", "Gimli"],
      ["Lieu", "Gondor"],
      ["Personnage", "Aragorn"],
    ]) {
      await createCard(type as string, title as string);
    }
    // Aragorn's alias and two mentions in his text.
    await $("aria/Nouvel alias").setValue("Grands-Pas");
    await $("button=Ajouter").click();
    await $("button*=Commencez à écrire").click();
    await $("aria/Bloc de texte 1").waitForDisplayed();
    for (const name of ["Arw", "Gond"]) {
      await browser.keys(`@${name}`);
      await $(`//*[@role="option"][contains(normalize-space(), "${name}")]`).waitForDisplayed();
      await browser.keys(["Enter", " "]);
    }
    await browser.pause(1200);

    await newDocument("Nouveau graph");
    await drawing().waitForDisplayed();
    await browser.waitUntil(
      async () =>
        (await (await drawing()).getAttribute("aria-label")) ===
        "Graph Graph sans nom : 4 cartes, 2 liens",
      { timeoutMsg: `drawing: ${await (await drawing()).getAttribute("aria-label")}` },
    );
    // Aragorn's neighbours in the list.
    await $('//*[@role="option"][normalize-space()="Aragorn"]').click();
    const linked = await $('//section[@aria-label="Cartes liées à Aragorn"]');
    expect(await linked.getText()).toContain("Arwen");
    expect(await linked.getText()).toContain("Gondor");
  });

  it("finds Aragorn by his alias", async () => {
    await $("aria/Rechercher dans le graph").click();
    await browser.keys("grands");
    await $("span=1 carte").waitForDisplayed();
    await browser.keys("Escape");
  });

  it("keeps the characters only with the « Personnage » filter", async () => {
    await $("aria/Filtrer par type").click();
    await $('//*[@role="menuitemcheckbox"][normalize-space()="Personnage"]').click();
    await browser.keys("Escape");
    await browser.waitUntil(async () => (await listTitle()) === "3 cartes", {
      timeoutMsg: `list: ${await listTitle()}`,
    });
  });

  it("does not move a pinned node when the repulsion changes", async () => {
    await $('//*[@role="option"][normalize-space()="Aragorn"]').click();
    await $("aria/Épingler Aragorn").click();
    await $("aria/Désépingler Aragorn").waitForDisplayed();
    // Aragorn is at the centre: selected from the list, the view went to him.
    expect(await cardAtCentre()).toBe("Aragorn");
    await $("aria/Réglages du graph").click();
    await setRange("Répulsion", 1500);
    await browser.keys("Escape");
    await browser.pause(2500);
    expect(await cardAtCentre()).toBe("Aragorn");
  });

  it("saves the configuration under a name; it reopens the same after reopening the world", async () => {
    await browser.pause(1500);
    await $("aria/Enregistrer sous…").click();
    await $("aria/Nom du nouveau graph").setValue("Famille");
    await $("button=Enregistrer").click();
    await $('//aside//*[@role="treeitem"][normalize-space()="Famille"]').waitForDisplayed();
    const before = await savedConfig("Famille");
    expect(before).not.toBeNull();
    expect(before).toBe(await savedConfig("Graph sans nom"));

    await $("button=Mondes").click();
    await $("h1=Mondes").waitForDisplayed();
    await $(`aria/Ouvrir ${WORLD}`).click();
    await currentWorldButton(WORLD).waitForDisplayed();
    await openTab("World");
    await $('//aside//*[@role="treeitem"][normalize-space()="Famille"]').click();
    await drawing().waitForDisplayed();
    expect(await savedConfig("Famille")).toBe(before);
    await browser.waitUntil(async () => (await listTitle()) === "3 cartes", {
      timeoutMsg: `filters after reopening: ${await listTitle()}`,
    });
    expect(await $("aria/Filtrer par type (actif)").isExisting()).toBe(true);
    await openCard("Aragorn");
  });
});
