/**
 * Steps shared by the end-to-end scenarios that work inside a world (M2 and
 * later). The app is in French (see wdio.conf.ts).
 */

export const currentWorldButton = (name: string) =>
  $(`aria/Monde courant : ${name}. Modifier le monde`);

export async function createWorld(name: string) {
  await $("button=Créer un monde").click();
  const nameInput = await $("aria/Nom");
  await nameInput.waitForDisplayed();
  await nameInput.setValue(name);
  await $("button=Créer").click();
  await currentWorldButton(name).waitForDisplayed();
}

export async function openTab(name: "Home" | "World") {
  await $(`//*[@role="tab"][@aria-label="${name}"]`).click();
}

export const sidebarLink = (title: string) => $(`//aside//a[normalize-space()="${title}"]`);

/** Creates a card of `type` from the sidebar and names it `title`. */
export async function createCard(type: string, title: string) {
  await $("button=Nouvelle carte").click();
  await $(`//*[@role="menuitem"][normalize-space()="${type}"]`).click();
  // The new card opens with its title selected (checked by the unit tests
  // and in the real app); here the title is replaced the way a user can
  // always do it, which does not depend on WebDriver's focus timing.
  const titleField = await $("aria/Nom de la carte");
  await browser.waitUntil(async () => (await titleField.getValue()) === `${type} sans nom`, {
    timeoutMsg: `the new ${type} card did not open`,
  });
  await titleField.click();
  await browser.keys(["Control", "a"]);
  await browser.keys(title);
  await sidebarLink(title).waitForDisplayed({ timeoutMsg: `${title} never showed in the sidebar` });
}

export async function openCard(title: string) {
  await sidebarLink(title).click();
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
