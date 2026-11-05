/**
 * End of M2 scenarios (docs/roadmap/M2-cartes-et-types.md, 2.19):
 * - a world theme is kept after closing and reopening the world;
 * - a custom theme's material and ornament dress the panels (#548), and its
 *   heading font sets the titles, loaded with the app (#549), and its mode
 *   wins over the app's while the world is shown (#550);
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
  openWorldSettings,
  writeInCard,
} from "../helpers";

const WORLD = "Valinor";

/** Opens the world settings on `section`. */
async function openSettings(section: string) {
  await openWorldSettings(WORLD);
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

const mentionCount = (title: string) => $$(`aria/Ouvrir la fiche ${title}`).length;

describe("M2: world settings, theme and writing preferences", () => {
  it("creates a world with two cards", async () => {
    await $("h1=Mondes").waitForDisplayed({ timeout: 30_000 });
    await createWorld(WORLD);
    await openTab("Monde");
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

  it("dresses the panels in the theme's material, ornament, heading font and mode (#548-#550)", async () => {
    // No picker yet (#552): the theme is saved through the command, then the
    // world is reopened.
    await browser.execute(() =>
      (
        window as unknown as {
          __TAURI_INTERNALS__: { invoke: (command: string, args: unknown) => Promise<unknown> };
        }
      ).__TAURI_INTERNALS__.invoke("set_world_theme", {
        theme: {
          kind: "custom",
          background: null,
          accent: "#5fcdc0",
          material: "stone",
          ornament: "edge",
          headingFont: "cinzel",
          scheme: "dark",
        },
      }),
    );
    await reopenWorld();
    await browser.waitUntil(
      async () =>
        browser.execute(() => {
          const root = document.documentElement;
          const radius = getComputedStyle(root).getPropertyValue("--bz-radius-lg").trim();
          const title = document.querySelector(".font-heading");
          return (
            root.dataset.material === "stone" &&
            root.dataset.ornament === "edge" &&
            radius === "2px" &&
            root.dataset.headingFont === "cinzel" &&
            root.dataset.theme === "dark" &&
            title !== null &&
            getComputedStyle(title).fontFamily.startsWith('"Cinzel Variable"') &&
            document.fonts.check('700 1em "Cinzel Variable"')
          );
        }),
      {
        timeoutMsg:
          "the stone material, the edge ornament, Cinzel or the dark mode were not applied",
      },
    );
    // The app settings stay in the world's mode and say it imposes one (#550).
    await $("aria/Réglages").click();
    await $("p*=Le monde ouvert s'affiche toujours en sombre").waitForDisplayed();
    expect(await browser.execute(() => document.documentElement.dataset.theme)).toBe("dark");
    await browser.keys("Escape");
    await $('[role="dialog"]').waitForExist({ reverse: true });
  });

  it("turns a typed card name into a mention, and no longer once switched off", async () => {
    await openTab("Monde");
    await openCard("Aragorn");
    await writeInCard();
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
    await openTab("Monde");
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
    // The world list is in the app's mode (« Système »), not the world's dark (#550).
    expect(
      await browser.execute(
        () =>
          document.documentElement.dataset.theme ===
          (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
      ),
    ).toBe(true);
    await createWorld("Númenor", "Science-fiction");
    await openTab("Monde");
    await expect($("aside [role=treeitem]")).not.toBeExisting();
    await openTab("Accueil");
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
