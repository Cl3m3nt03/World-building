import { createWorld, currentWorldButton } from "../helpers";

// V2-M2 (docs/roadmap/V2-M2-accueil.md): the start screen, the creation of a
// world, its Home, the world's card in the top bar and the search button.
// The specs run one after the other on the same BUILDERZ_HOME, so the worlds
// of the earlier specs are in the list too: these two are the latest opened.
const FIRST = "Atlas Un";
const SECOND = "Atlas Deux";

const backToWorlds = async () => {
  await $("button=Mondes").click();
  await $("h1=Mondes").waitForDisplayed();
};

describe("V2-M2: home and navigation", () => {
  before(async () => {
    await $("h1=Mondes").waitForDisplayed({ timeout: 30_000 });
  });

  it("creates a world with a genre tile and opens its Home on the world itself", async () => {
    await createWorld(FIRST, "Science-fiction");
    await expect($(`h1=Bienvenue dans ${FIRST}`)).toBeDisplayed();
    // No image yet: the header offers a cover, and the genre is said.
    await expect($("button=Ajouter une couverture")).toBeDisplayed();
    await expect($("p*=Science-fiction")).toBeDisplayed();
  });

  it("asks for a name on the spot", async () => {
    await backToWorlds();
    await $("button=Créer un monde").click();
    await $("aria/Nom").waitForDisplayed();
    await $("button=Créer").click();
    await expect($("p=Donnez un nom à votre monde.")).toBeDisplayed();
    await expect($("aria/Nom")).toHaveAttribute("aria-invalid", "true");
    await browser.keys("Escape");
    await $('[role="dialog"]').waitForExist({ reverse: true });
  });

  it("puts the last opened world forward, the others in the grid", async () => {
    await createWorld(SECOND);
    await backToWorlds();
    const banner = await $(`aria/Ouvrir ${SECOND}`);
    await expect(banner).toHaveText(expect.stringContaining("Reprendre"));
    await expect($(`//ul//*[@aria-label="Ouvrir ${FIRST}"]`)).toBeDisplayed();
  });

  it("switches world from the world's card", async () => {
    await $(`aria/Ouvrir ${SECOND}`).click();
    await currentWorldButton(SECOND).waitForDisplayed();
    await currentWorldButton(SECOND).click();
    const card = await $(`[role="dialog"][aria-label="Le monde ${SECOND}"]`);
    await card.waitForDisplayed();
    await card.$(`button*=${FIRST}`).click();
    await currentWorldButton(FIRST).waitForDisplayed();
    await expect($(`h1=Bienvenue dans ${FIRST}`)).toBeDisplayed();
  });

  it("the search button opens the World tab with the search field focused", async () => {
    await $('button[aria-label="Rechercher"]').click();
    await expect(browser).toHaveUrl(expect.stringContaining("/world"));
    const search = await $('aside input[role="combobox"]');
    await search.waitForDisplayed();
    await browser.waitUntil(async () => (await search.isFocused()) === true, {
      timeoutMsg: "the search field did not take the focus",
    });
  });

  it("leaving the world puts the focus on the list's title", async () => {
    await backToWorlds();
    await browser.waitUntil(
      async () => (await browser.execute(() => document.activeElement?.tagName)) === "H1",
      { timeoutMsg: "the focus is not on the world list's title" },
    );
  });
});
