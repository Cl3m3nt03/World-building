/**
 * M2 scenarios (docs/roadmap/M2-cartes-et-types.md, 2.14), after the
 * acceptance criteria of docs/features/01-cartes-et-types.md:
 * - a type property shows on the cards of the type, old and new;
 * - a link property and a mention each give a backlink on their target;
 * - a guided template applied to a card with text loses nothing.
 */

import { createCard, createWorld, openCard, openTab } from "../helpers";

const WORLD = "Terre du Milieu";

const popover = () => $('[data-slot="popover-content"]');

/** In the open types screen, adds a property to the selected type. */
async function addTypeProperty(label: string, kind: string) {
  await $("button=Ajouter une propriété").click();
  const name = await popover().$("input");
  await name.waitForDisplayed();
  await name.setValue(label);
  await popover().$('button[role="combobox"]').click();
  await $(`//*[@role="option"][normalize-space()="${kind}"]`).click();
  await browser.waitUntil(
    async () => (await popover().$('button[role="combobox"]').getText()).includes(kind),
    { timeoutMsg: `the kind ${kind} was not chosen` },
  );
  // Closing the small window saves the name.
  await browser.keys("Escape");
  await popover().waitForExist({ reverse: true });
  await $(`aria/Modifier la propriété ${label}`).waitForDisplayed();
}

async function openTypes() {
  await openTab("Home");
  await $("button=Types").click();
  await $("aria/Nom du type").waitForDisplayed();
}

async function closeTypes() {
  await browser.keys("Escape");
  await $('[role="dialog"]').waitForExist({ reverse: true });
}

/** "Cited in" entries of the open card, as their text. */
async function backlinks(): Promise<string[]> {
  const section = await $('section[aria-label="Cité dans"]');
  const texts: string[] = [];
  for (const link of await section.$$("a")) texts.push(await link.getText());
  return texts;
}

describe("M2: cards, properties, links and templates", () => {
  it("creates a world", async () => {
    await $("h1=Mondes").waitForDisplayed({ timeout: 30_000 });
    await createWorld(WORLD);
  });

  it("shows a type property on the cards of the type, created before and after it", async () => {
    await openTab("World");
    await createCard("Personnage", "Frodon");

    await openTypes();
    await addTypeProperty("Âge", "Nombre");
    // "Apply the changes to all the cards of this type?" Yes: Frodon too.
    await $("button=Oui").click();
    await $("button=Oui").waitForExist({ reverse: true });
    await closeTypes();

    await openTab("World");
    await createCard("Personnage", "Sam");
    await createCard("Personnage", "Merry");
    for (const title of ["Frodon", "Sam", "Merry"]) {
      await openCard(title);
      await expect($('input[aria-label="Âge"]')).toBeDisplayed();
    }
  });

  it("gives a backlink to the target of a link property and of a mention", async () => {
    await openTypes();
    await addTypeProperty("Lieu de naissance", "Lien vers une carte");
    await $("button=Oui").click();
    await closeTypes();

    await openTab("World");
    await createCard("Lieu", "Gondor");
    await createCard("Personnage", "Boromir");
    await createCard("Personnage", "Aragorn");

    // Link property: pick Gondor with the keyboard.
    await $("aria/Choisir une carte pour Lieu de naissance").click();
    const search = await $('input[role="combobox"]');
    await search.waitForDisplayed();
    await browser.keys("Gond");
    await $('//*[@role="option"][normalize-space()="Gondor"]').waitForDisplayed();
    await browser.keys("Enter");
    await $('section[aria-label="Propriétés"]').$("a=Gondor").waitForDisplayed();

    // Mention: "@Boro" in a text block, picked with Enter.
    await $("button*=Commencez à écrire").click();
    await $("aria/Bloc de texte 1").waitForDisplayed();
    await browser.keys("Ami de ");
    await browser.keys("@Boro");
    await $('//*[@role="option"][contains(normalize-space(), "Boromir")]').waitForDisplayed();
    await browser.keys("Enter");
    await $("aria/Ouvrir la carte Boromir").waitForDisplayed();

    await openCard("Gondor");
    await browser.waitUntil(
      async () =>
        (await backlinks()).some(
          (text) => text.includes("Aragorn") && text.includes("Lieu de naissance"),
        ),
      {
        timeoutMsg: "Gondor does not list Aragorn in its backlinks",
      },
    );

    await openCard("Boromir");
    await browser.waitUntil(
      async () =>
        (await backlinks()).some((text) => text.includes("Aragorn") && text.includes("mention")),
      {
        timeoutMsg: "Boromir does not list Aragorn's mention in its backlinks",
      },
    );
  });

  it("applies a guided template to a card with text without losing anything", async () => {
    await openCard("Aragorn");
    await $("aria/Actions de la carte").click();
    await $(
      '//*[@role="menuitem"][normalize-space()="Appliquer le template « Personnage »"]',
    ).click();

    for (const heading of ["Background", "Personnalité", "Apparence"]) {
      await $(
        `//section[@aria-label="Contenu"]//h2[normalize-space()="${heading}"]`,
      ).waitForDisplayed();
    }
    // The text written before is still there, first.
    await expect($("aria/Bloc de texte 1")).toHaveText(expect.stringContaining("Ami de"));

    // And kept after leaving the card and coming back.
    await openCard("Gondor");
    await openCard("Aragorn");
    await $(
      '//section[@aria-label="Contenu"]//h2[normalize-space()="Apparence"]',
    ).waitForDisplayed();
    await expect($("aria/Bloc de texte 1")).toHaveText(expect.stringContaining("Ami de"));
  });
});
