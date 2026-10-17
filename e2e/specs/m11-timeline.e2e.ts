/**
 * M11 scenarios (docs/roadmap/M11-frise.md, 11.7), the acceptance criteria
 * of docs/features/09-frise.md:
 * - the world's calendar set (an era);
 * - a timeline with two cards placed on it, one made a period;
 * - « Cité dans » of a card opens the timeline on its item;
 * - an item moved a year later, kept after reopening the world.
 */

import { createCard, createWorld, currentWorldButton, openTab, sidebarItem } from "../helpers";

const WORLD = "Westeros";
const TIMELINE = "Nouvelle frise";
const YEAR = 360;

type Item = { cardId: string | null; start: number; end: number | null };
type Invoke = { invoke: (command: string, args?: object) => Promise<unknown> };

/** The timeline's items as saved by the Rust side, with their cards' names. */
const saved = () =>
  browser.execute(async (title) => {
    const internals = (window as unknown as { __TAURI_INTERNALS__: Invoke }).__TAURI_INTERNALS__;
    const tree = (await internals.invoke("document_tree")) as {
      documents: { id: string; title: string; kind: string }[];
    };
    const timeline = tree.documents.find(
      (candidate) => candidate.title === title && candidate.kind === "timeline",
    );
    if (!timeline) return null;
    const cards = (await internals.invoke("list_cards", { trashed: false })) as {
      id: string;
      title: string;
    }[];
    const { items } = (await internals.invoke("get_timeline", { id: timeline.id })) as {
      items: Item[];
    };
    return items.map((item) => ({
      ...item,
      card: cards.find((card) => card.id === item.cardId)?.title ?? null,
    }));
  }, TIMELINE);

/** The saved item standing for `card`, once it matches `check`. */
async function itemOf(card: string, check: (item: Item) => boolean, message: string) {
  let found: Item | undefined;
  await browser.waitUntil(
    async () => {
      found = (await saved())?.find((item) => item.card === card);
      return found !== undefined && check(found);
    },
    { timeoutMsg: message },
  );
  return found as Item;
}

/** A bubble of the axis view, by the start of its name. */
const bubble = (name: string) =>
  $(`//*[@role="application"]//button[starts-with(@aria-label, "${name}, ")]`);

const dialog = () => $('[role="dialog"]');

describe("M11: the timeline", () => {
  it("sets the world's calendar: an era from year 0", async () => {
    await createWorld(WORLD);
    await openTab("World");
    await createCard("Personnage", "Robert Baratheon");
    await createCard("Personnage", "Eddard Stark");

    await currentWorldButton(WORLD).click();
    await dialog().$('//*[@role="tab"][normalize-space()="Calendrier"]').click();
    await dialog().$("button=Ajouter une ère").click();
    await dialog().$("aria/Nom de l'ère").setValue("Après la Conquête");
    await dialog().$("aria/Abréviation").setValue("AC");
    await dialog().$("span*=Exemple : 12 du 3e mois 298 AC").waitForDisplayed({
      timeoutMsg: "the example date did not use the era",
    });
    await dialog().$("button=Enregistrer le calendrier").click();
    await browser.waitUntil(
      async () =>
        browser.execute(async () => {
          const internals = (window as unknown as { __TAURI_INTERNALS__: Invoke })
            .__TAURI_INTERNALS__;
          const world = (await internals.invoke("current_world")) as {
            calendar: { eras: { abbreviation: string }[] };
          };
          return world.calendar.eras[0]?.abbreviation === "AC";
        }),
      { timeoutMsg: "the calendar was not saved" },
    );
    await browser.keys("Escape");
    await dialog().waitForExist({ reverse: true });
  });

  it("places two cards on a new timeline, and makes one a period", async () => {
    await $("aria/Nouveau document (map, graph, arbre, canvas, frise…)").click();
    await $('//*[@role="menuitem"][normalize-space()="Nouvelle frise"]').click();
    await $(`aria/Frise ${TIMELINE}`).waitForDisplayed({ timeoutMsg: "the timeline did not open" });

    await $("button=Ajouter").click();
    await $('//*[@role="menuitem"][normalize-space()="Des cartes…"]').click();
    await dialog().$("aria/Chercher une carte").waitForDisplayed();
    await dialog().$('//label[contains(., "Robert Baratheon")]//input').click();
    await dialog().$('//label[contains(., "Eddard Stark")]//input').click();
    const year = await dialog().$("aria/Année");
    await year.clearValue();
    await year.setValue("283");
    await dialog().$("button=Placer 2 cartes").click();
    await itemOf("Robert Baratheon", (item) => item.start === 283 * YEAR, "Robert was not placed");
    await itemOf("Eddard Stark", (item) => item.start === 283 * YEAR, "Eddard was not placed");
    // The first placed item opened in its card: closed, so it hides no bubble.
    await $("aria/Fermer le détail").click();
    await $("aria/Élément sélectionné").waitForExist({ reverse: true });

    // Eddard becomes a period, from the item's card.
    await bubble("Eddard Stark").click();
    const card = await $("aria/Élément sélectionné");
    await card.$("button*=283 AC").click();
    await card.$('//*[@role="switch"]').click();
    await itemOf("Eddard Stark", (item) => item.end !== null, "Eddard did not become a period");
    await card.$("aria/Fermer le détail").click();
  });

  it("opens the timeline on a card's item from « Cité dans »", async () => {
    await bubble("Robert Baratheon").doubleClick();
    await browser.waitUntil(
      async () => (await $("aria/Nom de la carte").getValue()) === "Robert Baratheon",
      { timeoutMsg: "the double click did not open Robert's card" },
    );
    const cited = await $("aria/Cité dans");
    await cited.scrollIntoView();
    await cited.$(`a*=${TIMELINE}`).click();
    await browser.waitUntil(
      async () => (await bubble("Robert Baratheon").getAttribute("aria-pressed")) === "true",
      { timeoutMsg: "the timeline did not open with Robert selected" },
    );
  });

  it("keeps an item moved a year later after reopening the world", async () => {
    // Alt + right arrow: one unit later, never finer than the date (a year).
    // The bubble takes the focus by script: the item card, open beside it in
    // the CI's small window, could catch a click.
    await browser.execute(
      (element) => (element as unknown as HTMLElement).focus(),
      await bubble("Robert Baratheon"),
    );
    await browser.keys(["Alt", "ArrowRight"]);
    await itemOf(
      "Robert Baratheon",
      (item) => item.start === 284 * YEAR,
      "Robert was not moved a year later",
    );

    await $("button=Mondes").click();
    await $("h1=Mondes").waitForDisplayed();
    await $(`aria/Ouvrir ${WORLD}`).click();
    await currentWorldButton(WORLD).waitForDisplayed();
    await openTab("World");
    await sidebarItem(TIMELINE).click();
    await $("aria/Robert Baratheon, 284 AC").waitForDisplayed({
      timeoutMsg: "the move was not kept",
    });
    await itemOf("Robert Baratheon", (item) => item.start === 284 * YEAR, "the move was lost");
  });
});
