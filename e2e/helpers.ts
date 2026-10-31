/**
 * Steps shared by the end-to-end scenarios that work inside a world (M2 and
 * later). The app is in French (see wdio.conf.ts).
 */

export const currentWorldButton = (name: string) => $(`aria/Monde courant : ${name}`);

/** The world's settings: the world island opens the world's card, then its settings. */
export async function openWorldSettings(name: string) {
  await currentWorldButton(name).click();
  await $('//*[@role="dialog"]//button[normalize-space()="Réglages du monde"]').click();
  await $(
    '//*[@role="dialog"][.//*[normalize-space()="Réglages du monde"]]//*[@role="tablist"]',
  ).waitForDisplayed();
}

export async function createWorld(name: string, genre?: string) {
  await $("button=Créer un monde").click();
  const nameInput = await $("aria/Nom");
  await nameInput.waitForDisplayed();
  await nameInput.setValue(name);
  if (genre) {
    await $(`//*[@role="dialog"]//*[@role="radio"][normalize-space()="${genre}"]`).click();
  }
  await $("button=Créer").click();
  await currentWorldButton(name).waitForDisplayed();
}

export async function openTab(name: "Accueil" | "Monde") {
  await $(`//*[@role="tab"][@aria-label="${name}"]`).click();
}

/** A row of the sidebar tree, by its name. */
export const sidebarItem = (title: string) =>
  $(`//aside//*[@role="treeitem"][normalize-space()="${title}"]`);

/** Creates a card of `type` from the sidebar and names it `title`. */
export async function createCard(type: string, title: string) {
  await $("button=Nouvelle fiche").click();
  await $(`//*[@role="option"][normalize-space()="${type}"]`).click();
  await nameNewCard(type, title);
}

/** Types in the search field of the open type panel, once it has the focus. */
export async function typeInPicker(text: string) {
  await $('input[aria-label="Rechercher un type"]').waitForDisplayed();
  await browser.waitUntil(
    async () =>
      browser.execute(
        () => document.activeElement?.getAttribute("aria-label") === "Rechercher un type",
      ),
    { timeoutMsg: "the type panel's search did not take the focus" },
  );
  await browser.keys(text);
}

/** A card of `type` was just created: gives it its name. */
export async function nameNewCard(type: string, title: string) {
  // The new card opens with its title selected: typing at once replaces it
  // (keys typed while the menu was still closing used to be lost, #122).
  const titleField = await $("aria/Nom de la fiche");
  await browser.waitUntil(
    async () =>
      browser.execute(() => {
        const input = document.activeElement;
        return (
          input instanceof HTMLInputElement &&
          input.value.endsWith(" sans nom") &&
          input.selectionStart === 0 &&
          input.selectionEnd === input.value.length
        );
      }),
    { timeoutMsg: `the new ${type} card did not open with its title selected` },
  );
  await browser.keys(title);
  await browser.waitUntil(async () => (await titleField.getValue()) === title, {
    timeoutMsg: `typing did not replace the title of the new ${type} card`,
  });
  await sidebarItem(title).waitForDisplayed({ timeoutMsg: `${title} never showed in the sidebar` });
}

/**
 * Puts the caret where text goes in the open card: its first text block,
 * at the end. An empty card offers "Start writing"; a new card of a type
 * with a guided template already has its sections (V2-3.5), and the caret
 * then lands in the first section, under its title.
 */
export async function writeInCard() {
  const start = () => $("button*=Commencez à écrire");
  const first = () => $("aria/Bloc de texte 1");
  await browser.waitUntil(async () => (await start().isExisting()) || first().isExisting(), {
    timeoutMsg: "the card's content never showed",
  });
  if (await start().isExisting()) await start().click();
  await first().waitForDisplayed();
  await first().click();
  await browser.keys(["Control", "End"]);
}

export async function openCard(title: string) {
  await sidebarItem(title).click();
  await browser.waitUntil(async () => (await $("aria/Nom de la fiche").getValue()) === title, {
    timeoutMsg: `the card ${title} did not open`,
  });
}

/** Source of the full-screen backdrop image, or null for the default gradient. */
export async function backdropSource(): Promise<string | null> {
  return browser.execute(
    () => document.querySelector<HTMLImageElement>("div[aria-hidden] > img")?.src ?? null,
  );
}
