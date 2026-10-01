/**
 * End of M2 scenarios (docs/roadmap/M2-cartes-et-types.md, 2.19):
 * - a world theme is kept after closing and reopening the world;
 * - a typed card name becomes a mention, and no longer once the automatic
 *   links are switched off (kept after reopening the world);
 * - another world shows nothing of this one (#109);
 * - a deleted world leaves the world list.
 */

import {
  backdropSource,
  createCard,
  createWorld,
  currentWorldButton,
  openCard,
  openTab,
} from "../helpers";

const WORLD = "Valinor";

/** Opens the world settings on `section`. */
async function openSettings(section: string) {
  await currentWorldButton(WORLD).click();
  await $('[role="dialog"]').waitForDisplayed();
  await $(`//*[@role="dialog"]//*[@role="tab"][normalize-space()="${section}"]`).click();
  await $(`//*[@role="dialog"]//h2[normalize-space()="${section}"]`).waitForDisplayed();
}

async function closeSettings() {
  await browser.keys("Escape");
  await $('[role="dialog"]').waitForExist({ reverse: true });
}

/** Closes the world and opens it again from the world list. */
async function reopenWorld() {
  await $("button=Mondes").click();
  await $("h1=Mondes").waitForDisplayed();
  await $(`aria/Ouvrir ${WORLD}`).click();
  await currentWorldButton(WORLD).waitForDisplayed();
}

const mentionCount = (title: string) => $$(`aria/Ouvrir la carte ${title}`).length;

describe("M2: world settings, theme and writing preferences", () => {
  it("creates a world with two cards", async () => {
    await $("h1=Mondes").waitForDisplayed({ timeout: 30_000 });
    await createWorld(WORLD);
    await openTab("World");
    await createCard("Lieu", "Gondor");
    await createCard("Personnage", "Aragorn");
  });

  it("keeps the theme chosen for the world after reopening it", async () => {
    await openSettings("Thème");
    await $('[role="dialog"] [role="radio"][aria-label="Forêt ancienne"]').click();
    await browser.waitUntil(async () => (await backdropSource())?.includes("forest") ?? false, {
      timeoutMsg: "the forest illustration never became the backdrop",
    });
    await closeSettings();

    await reopenWorld();
    await browser.waitUntil(async () => (await backdropSource())?.includes("forest") ?? false, {
      timeoutMsg: "the theme was not kept",
    });
  });

  it("turns a typed card name into a mention, and no longer once switched off", async () => {
    await openTab("World");
    await openCard("Aragorn");
    await $("button*=Commencez à écrire").click();
    await $("aria/Bloc de texte 1").waitForDisplayed();
    await browser.keys("Né au Gondor ");
    await browser.waitUntil(async () => (await mentionCount("Gondor")) === 1, {
      timeoutMsg: "the typed name did not become a mention",
    });

    await openSettings("Préférences");
    // The switch named by "Liens automatiques des mentions".
    const autoLinks = await $(
      '//*[@role="dialog"]//*[@role="switch"][@aria-labelledby=//span[normalize-space()="Liens automatiques des mentions"]/@id]',
    );
    await expect(autoLinks).toHaveAttribute("aria-checked", "true");
    await autoLinks.click();
    await expect(autoLinks).toHaveAttribute("aria-checked", "false");
    await closeSettings();

    // Closed right after typing: the text was saved all the same (#106).
    await reopenWorld();
    await openTab("World");
    await openCard("Aragorn");
    await browser.waitUntil(async () => (await mentionCount("Gondor")) === 1, {
      timeoutMsg: "the text typed before closing the world was lost",
    });
    await $("aria/Bloc de texte 1").click();
    await browser.keys(["Control", "End"]);
    await browser.keys("puis le Gondor ");
    await expect($("aria/Bloc de texte 1")).toHaveText(expect.stringContaining("puis le Gondor"));
    // Still the one mention typed before: the second name stayed text.
    expect(await mentionCount("Gondor")).toBe(1);
  });

  it("shows nothing of this world in another one", async () => {
    await $("button=Mondes").click();
    await $("h1=Mondes").waitForDisplayed();
    await createWorld("Númenor", "Science-fiction");
    await openTab("World");
    await expect($("aside [role=treeitem]")).not.toBeExisting();
    await openTab("Home");
    await $("button=Types").click();
    await $('//*[@role="dialog"]//button[normalize-space()="Vaisseau"]').waitForDisplayed();
    await expect(
      $('//*[@role="dialog"]//button[normalize-space()="Système de magie"]'),
    ).not.toBeExisting();
    await browser.keys("Escape");
    await $('[role="dialog"]').waitForExist({ reverse: true });

    await reopenWorld();
  });

  it("deletes the world, which leaves the world list", async () => {
    await openSettings("Préférences");
    await $('//*[@role="dialog"]//button[normalize-space()="Supprimer le monde"]').click();
    const confirm = await $('[role="alertdialog"]');
    await confirm.waitForDisplayed();
    await confirm.$("input").setValue(WORLD);
    await confirm.$("button=Supprimer le monde").click();

    await $("h1=Mondes").waitForDisplayed({ timeout: 20_000 });
    await expect($(`aria/Ouvrir ${WORLD}`)).not.toBeExisting();
  });
});
