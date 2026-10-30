/**
 * V2-M3 scenarios (docs/roadmap/V2-M3-fiches.md, 3.7), in the order a card is
 * made, on a Fantasy world:
 * - the type panel: search, keyboard, subtypes, « Nouveau type »;
 * - the header: the type chip, the wiki eye, the aliases on their line;
 * - the add property window, on a card (the types screen's use of the same
 *   window is in m2-cards);
 * - the template on creation for what m2-cards leaves out: a subtype using its
 *   type's template, a type without one, a template written in the types screen;
 * - the sections: the « / » menu's text forms, folding, copying a block.
 */

import { createWorld, nameNewCard, openCard, openTab, typeInPicker } from "../helpers";

const WORLD = "Fiches";

const popover = () => $('[data-slot="popover-content"]');
const content = () => $('section[aria-label="Contenu"]');
const openMenu = () => $('//*[@role="menu"][@data-state="open"]');
const option = (name: string) =>
  $(`//*[@role="option"][starts-with(normalize-space(), "${name}")]`);
const textBlock = (index: number) => $(`[aria-label="Bloc de texte ${index}"]`);

/** Options of the open type panel, as their text. */
async function options(): Promise<string[]> {
  const texts: string[] = [];
  for (const entry of await $$('[role="option"]')) texts.push(await entry.getText());
  return texts;
}

/** An entry of the last menu opened (its shortcut may follow its name). */
async function menuEntry(entry: string) {
  await openMenu().waitForDisplayed();
  const entries = await $$(
    `//*[@role="menu"][@data-state="open"]//*[@role="menuitem"][starts-with(normalize-space(), "${entry}")]`,
  );
  const last = entries[(await entries.length) - 1];
  if (!last) throw new Error(`no entry "${entry}" in the open menu`);
  await last.click();
}

/** The menu must be gone first: while it fades out, its entries would still match. */
const menuGone = () => $('[role="menu"]').waitForExist({ reverse: true });

/** « / » on the empty line under the caret, then an entry of its menu. */
async function slash(entry: string) {
  await browser.keys("/");
  await menuEntry(entry);
  await menuGone();
}

/** The type chip of the open card shows `label`. */
const typeChip = (label: string) => $(`aria/Type : ${label}. Changer le type`);

/** Fills the add property window of the open card, then closes the editor it opens. */
async function addCardProperty(label: string, pick: () => Promise<void>) {
  await $("button=Ajouter une propriété").click();
  await popover().$("input").waitForDisplayed();
  await browser.waitUntil(
    async () => browser.execute(() => document.activeElement?.tagName === "INPUT"),
    { timeoutMsg: "the name of the new property did not take the focus" },
  );
  await browser.keys(label);
  await pick();
  await $(`aria/Modifier la propriété ${label}`).waitForDisplayed();
  await popover().$("input").waitForDisplayed();
  await browser.keys("Escape");
  await popover().waitForExist({ reverse: true });
}

describe("V2-M3: the cards", () => {
  it("creates a world", async () => {
    await $("h1=Mondes").waitForDisplayed({ timeout: 30_000 });
    await createWorld(WORLD, "Fantasy");
    await openTab("World");
    await $("button=Nouvelle carte").waitForDisplayed({ timeout: 20_000 });
  });

  it("creates a card with the keyboard alone in the type panel", async () => {
    await $("button=Nouvelle carte").click();
    await typeInPicker("eve");
    await browser.waitUntil(async () => (await options()).length === 1, {
      timeoutMsg: "the search without accents did not narrow the list to Événement",
    });
    await expect(option("Événement")).toBeDisplayed();
    await browser.keys("Enter");
    await nameNewCard("Événement", "Sacre");
    await expect(typeChip("Événement")).toBeDisplayed();
  });

  it("brings a subtype's type along and closes on Escape", async () => {
    await $("button=Nouvelle carte").click();
    await typeInPicker("ham");
    await browser.waitUntil(async () => (await options()).join() === ["Lieu", "Hameau"].join(), {
      timeoutMsg: "the subtype Hameau did not show under its type",
    });
    await browser.keys("Escape");
    await $('[role="listbox"]').waitForExist({ reverse: true });
    await expect($("button=Nouvelle carte")).toBeFocused();
  });

  it("changes the type from the chip, the current type marked", async () => {
    await typeChip("Événement").click();
    await popover().$("p=Changer de type").waitForDisplayed();
    await expect(option("Événement")).toHaveText(expect.stringContaining("Actuel"));
    await typeInPicker("Lieu");
    await option("Lieu").click();
    await typeChip("Lieu").waitForDisplayed();
    await popover().waitForExist({ reverse: true });

    await typeChip("Lieu").click();
    await typeInPicker("Royaume");
    await option("Lieu").waitForDisplayed();
    await browser.keys("ArrowDown");
    await browser.keys("Enter");
    await typeChip("Lieu › Royaume").waitForDisplayed();
  });

  it("shows the card in the wiki, or not, from the eye", async () => {
    const eye = () => $('button[aria-label="Visible dans le wiki"]');
    const row = () =>
      $(
        '//aside//*[@role="treeitem"][starts-with(normalize-space(), "Sacre")][contains(., "visible dans le wiki")]',
      );
    await expect(eye()).toHaveAttribute("aria-pressed", "false");

    await eye().click();
    await browser.waitUntil(async () => (await eye().getAttribute("aria-pressed")) === "true", {
      timeoutMsg: "the eye did not light up",
    });
    await row().waitForExist();
    // The card's menu says the same.
    await $("aria/Actions de la carte").click();
    await expect(
      $('//*[@role="menuitemcheckbox"][normalize-space()="Visible dans le wiki"]'),
    ).toHaveAttribute("aria-checked", "true");
    await browser.keys("Escape");
    await menuGone();

    await eye().click();
    await browser.waitUntil(async () => (await eye().getAttribute("aria-pressed")) === "false", {
      timeoutMsg: "the eye did not go off",
    });
    await row().waitForExist({ reverse: true });
  });

  it("adds and removes aliases on their line", async () => {
    const field = () => $("aria/Nouvel alias");
    const pills = () => $$('button[aria-label^="Retirer l\'alias"]').length;

    await field().click();
    await browser.keys("Couronnement");
    // The button shows as soon as something is typed.
    await $("button=Ajouter").click();
    await $("aria/Retirer l'alias Couronnement").waitForDisplayed();
    await browser.waitUntil(async () => (await field().getValue()) === "", {
      timeoutMsg: "the field kept the added alias",
    });
    await expect($("button=Ajouter")).not.toBeExisting();

    await field().click();
    await browser.keys("Avènement");
    await browser.keys("Enter");
    await $("aria/Retirer l'alias Avènement").waitForDisplayed();

    // A duplicate, in another case, is ignored.
    await field().click();
    await browser.keys("COURONNEMENT");
    await browser.keys("Enter");
    await browser.waitUntil(async () => (await field().getValue()) === "", {
      timeoutMsg: "the duplicate stayed in the field",
    });
    expect(await pills()).toBe(2);

    await $("aria/Retirer l'alias Couronnement").click();
    await $("aria/Retirer l'alias Couronnement").waitForExist({ reverse: true });
    expect(await pills()).toBe(1);
  });

  it("keeps the header inside the page at 1028×749", async () => {
    const overflow = await browser.execute(() => {
      const page = document.querySelector("article");
      return page ? page.scrollWidth - page.clientWidth : -1;
    });
    expect(overflow).toBe(0);
  });

  it("adds a card's own properties in two gestures", async () => {
    // Enter alone makes a text property.
    await addCardProperty("Devise", () => browser.keys("Enter"));
    await $('input[aria-label="Devise"]').setValue("Vivre libre");

    await addCardProperty("Convives", () => popover().$("button=Nombre").click());
    await $('input[aria-label="Convives"]').setValue("300");

    // Saved without a button: they are there after coming back.
    await $("button=Nouvelle carte").click();
    await typeInPicker("Personnage");
    await option("Personnage").waitForDisplayed();
    await browser.keys("Enter");
    await nameNewCard("Personnage", "Aldor");
    await openCard("Sacre");
    await browser.waitUntil(
      async () => (await $('input[aria-label="Convives"]').getValue()) === "300",
      { timeoutMsg: "the number property was not kept" },
    );
    await expect($('input[aria-label="Devise"]')).toHaveValue("Vivre libre");
  });

  it("links to cards of a given type, several at a time", async () => {
    await $("button=Nouvelle carte").click();
    await typeInPicker("Lieu");
    await option("Lieu").waitForDisplayed();
    await browser.keys("Enter");
    await nameNewCard("Lieu", "Valmorne");
    await $("button=Nouvelle carte").click();
    await typeInPicker("Lieu");
    await option("Lieu").waitForDisplayed();
    await browser.keys("Enter");
    await nameNewCard("Lieu", "Hautecombe");
    await openCard("Sacre");

    await addCardProperty("Terres", async () => {
      await popover().$("label=Plusieurs cartes à la fois").click();
      await popover().$('.//button[normalize-space()="Lieu"]').click();
    });

    const pick = async (title: string) => {
      await $("aria/Choisir une carte pour Terres").click();
      await popover().$('input[role="combobox"]').waitForDisplayed();
      await browser.waitUntil(async () => popover().$('input[role="combobox"]').isFocused(), {
        timeoutMsg: "the card picker's search did not take the focus",
      });
      await browser.keys(title);
    };
    // A character is not a location: not offered.
    await pick("Aldor");
    await $("*=Aucune carte ne correspond").waitForDisplayed();
    await browser.keys("Escape");
    await popover().waitForExist({ reverse: true });

    for (const title of ["Valmorne", "Hautecombe"]) {
      await pick(title);
      await option(title).waitForDisplayed();
      await browser.keys("Enter");
      await $(`ul[aria-label="Terres"]`).$(`a=${title}`).waitForDisplayed();
    }
  });

  it("gives a new card of a subtype its type's template", async () => {
    await $("button=Nouvelle carte").click();
    await typeInPicker("ham");
    await option("Lieu").waitForDisplayed();
    await browser.keys("ArrowDown");
    await browser.keys("Enter");
    await nameNewCard("Hameau", "Bourg-Moussu");
    await typeChip("Lieu › Hameau").waitForDisplayed();
    await content().$('.//h2[normalize-space()="Géographie"]').waitForDisplayed();
  });

  it("opens the types screen from the panel, for a type without a template", async () => {
    await $("button=Nouvelle carte").click();
    await $('[role="listbox"]').waitForDisplayed();
    await $("button=Nouveau type").click();
    await $('[role="listbox"]').waitForExist({ reverse: true });
    const screen = await $('[role="dialog"]');
    await screen.waitForDisplayed();
    await screen.$("button=Nouveau type").click();
    // The new type opens once it exists: only then is its name the field's.
    await browser.waitUntil(
      async () => (await $("aria/Nom du type").getValue()) === "Nouveau type",
      {
        timeoutMsg: "the new type did not open",
      },
    );
    await $("aria/Nom du type").setValue("Chronique");
    await screen.$("//*[normalize-space()='Chronique']").waitForDisplayed();
    await browser.keys("Escape");
    await $('[role="dialog"]').waitForExist({ reverse: true });

    await $("button=Nouvelle carte").click();
    await typeInPicker("Chronique");
    await option("Chronique").waitForDisplayed();
    await browser.keys("Enter");
    await nameNewCard("Chronique", "Annales");
    await $("button*=Commencez à écrire").waitForDisplayed();
    await expect($("button*=Utiliser le template")).not.toBeExisting();
    await expect(content().$("h2")).not.toBeExisting();
  });

  it("turns the line where « / » is typed into a heading, a list, a quote", async () => {
    await $("button*=Commencez à écrire").click();
    await textBlock(1).waitForDisplayed();
    await browser.waitUntil(
      async () => browser.execute(() => document.activeElement?.getAttribute("role") === "textbox"),
      { timeoutMsg: "the new text block did not take the focus" },
    );

    // The menu in families, each form with its shortcut, Escape at its foot.
    await browser.keys("/");
    await openMenu().waitForDisplayed();
    await expect(openMenu()).toHaveText(expect.stringContaining("Cette ligne devient…"));
    await expect(
      $(
        '//*[@role="menuitem"][contains(normalize-space(), "Titre 2")]/*[@data-slot="dropdown-menu-shortcut"]',
      ),
    ).toHaveText("##");
    await expect(openMenu()).toHaveText(expect.stringContaining("Fermer le menu"));
    await browser.keys("Escape");
    await menuGone();

    // Escape gives the focus back to the line.
    await browser.keys("Le");
    await browser.waitUntil(async () => (await textBlock(1).getText()) === "Le", {
      timeoutMsg: "the line did not get the focus back after Escape",
    });
    await browser.keys(["Control", "a"]);
    await browser.keys("Backspace");

    await slash("Titre 2");
    await browser.keys("Grand sacre");
    await textBlock(1).$('.//h2[normalize-space()="Grand sacre"]').waitForDisplayed();

    await browser.keys("Enter");
    await slash("Liste à puces");
    await browser.keys("Le roi");
    await textBlock(1).$('.//ul/li[normalize-space()="Le roi"]').waitForDisplayed();

    await browser.keys("Enter");
    await browser.keys("Enter");
    await slash("Citation");
    await browser.keys("Vive le roi");
    await textBlock(1).$('.//blockquote[normalize-space()="Vive le roi"]').waitForDisplayed();
  });

  it("folds a block and unfolds it", async () => {
    await $("aria/Replier le bloc 1").click();
    const unfold = await $("aria/Déplier le bloc 1");
    await unfold.waitForDisplayed();
    await expect(unfold).toHaveAttribute("aria-expanded", "false");
    expect(
      await browser.execute(
        () => document.querySelector('[aria-label="Bloc de texte 1"]')?.closest("[inert]") !== null,
      ),
    ).toBe(true);

    await unfold.click();
    await $("aria/Replier le bloc 1").waitForDisplayed();
    expect(
      await browser.execute(
        () => document.querySelector('[aria-label="Bloc de texte 1"]')?.closest("[inert]") === null,
      ),
    ).toBe(true);
  });

  it("copies a block and adds another one under it, both kept", async () => {
    await $("aria/Actions du bloc 1").click();
    await menuEntry("Copier le bloc");
    await menuGone();
    await textBlock(2).waitForDisplayed();
    await expect(textBlock(2)).toHaveText(expect.stringContaining("Grand sacre"));

    await $("aria/Actions du bloc 1").click();
    await menuEntry("Ajouter un bloc dessous");
    await menuEntry("Texte");
    await menuGone();
    await textBlock(3).waitForDisplayed();
    await textBlock(2).click();
    await browser.keys("Entre les deux");
    await browser.waitUntil(async () => (await textBlock(2).getText()) === "Entre les deux", {
      timeoutMsg: "the new block did not take the text",
    });

    await openCard("Sacre");
    await openCard("Annales");
    await expect(textBlock(1)).toHaveText(expect.stringContaining("Grand sacre"));
    await expect(textBlock(2)).toHaveText("Entre les deux");
    await expect(textBlock(3)).toHaveText(expect.stringContaining("Grand sacre"));
  });
});
