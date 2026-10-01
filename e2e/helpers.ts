/**
 * Steps shared by the end-to-end scenarios that work inside a world (M2 and
 * later). The app is in French (see wdio.conf.ts).
 */

export const currentWorldButton = (name: string) =>
  $(`aria/Monde courant : ${name}. Modifier le monde`);

export async function createWorld(name: string, genre?: string) {
  await $("button=Créer un monde").click();
  const nameInput = await $("aria/Nom");
  await nameInput.waitForDisplayed();
  await nameInput.setValue(name);
  if (genre) {
    await $('[role="dialog"] button[role="combobox"]').click();
    await $(`//*[@role="option"][normalize-space()="${genre}"]`).click();
  }
  await $("button=Créer").click();
  await currentWorldButton(name).waitForDisplayed();
}

export async function openTab(name: "Home" | "World") {
  await $(`//*[@role="tab"][@aria-label="${name}"]`).click();
}

/** A row of the sidebar tree, by its name. */
export const sidebarItem = (title: string) =>
  $(`//aside//*[@role="treeitem"][normalize-space()="${title}"]`);

/** Creates a card of `type` from the sidebar and names it `title`. */
export async function createCard(type: string, title: string) {
  await $("button=Nouvelle carte").click();
  await $(`//*[@role="menuitem"][normalize-space()="${type}"]`).click();
  // The new card opens with its title selected: typing at once replaces it
  // (keys typed while the menu was still closing used to be lost, #122).
  const titleField = await $("aria/Nom de la carte");
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

export async function openCard(title: string) {
  await sidebarItem(title).click();
  await browser.waitUntil(async () => (await $("aria/Nom de la carte").getValue()) === title, {
    timeoutMsg: `the card ${title} did not open`,
  });
}

/** Source of the full-screen backdrop image, or null for the default gradient. */
export async function backdropSource(): Promise<string | null> {
  return browser.execute(
    () => document.querySelector<HTMLImageElement>("div[aria-hidden] > img")?.src ?? null,
  );
}
