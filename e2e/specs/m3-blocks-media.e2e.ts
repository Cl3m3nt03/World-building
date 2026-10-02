import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createCard, createWorld, currentWorldButton, openCard, openTab } from "../helpers";

/**
 * M3 scenarios for the recette of 3.10 to 3.13 (issue #135):
 * - an image block of three images, gone through with the mouse and the
 *   keyboard, identical after reopening the world (3.10);
 * - two blocks side by side, kept after reopening, stacked on a narrow
 *   window (3.11);
 * - an image of one world reused in another through the BuilderZ library,
 *   copied into it (3.13);
 * - the space of a world shown, and an import refused once its limit is
 *   reached (3.12).
 */

const FIRST = "Valinor";
const SECOND = "Numenor";

function builderzHome(): string {
  const home = process.env.BUILDERZ_HOME;
  if (!home) throw new Error("BUILDERZ_HOME is not set (see e2e/wdio.conf.ts)");
  return home;
}

/** A 2×2 PNG. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGNwSFgARAwQCgAhjgUBvM8p0wAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * A valid PNG named `name`, distinct from the others (bytes after the end of
 * a PNG are ignored by image decoders but change its hash), `padding` bytes long.
 */
function image(name: string, padding = 16): string {
  const file = path.join(builderzHome(), "fixtures-m3", name);
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, Buffer.concat([PNG, Buffer.alloc(padding, name.charCodeAt(0))]));
  }
  return file;
}

/** The next native file dialog returns `result` (see src/lib/dialogs.ts). */
async function pickNext(result: string | string[]) {
  await browser.execute((value) => {
    const page = window as Window & { __bzE2eDialogAnswers?: (string | string[])[] };
    page.__bzE2eDialogAnswers = [...(page.__bzE2eDialogAnswers ?? []), value];
  }, result);
}

/** Leaves the world for the world list and opens `name` again. */
async function reopenWorld(name: string) {
  await $("button=Mondes").click();
  await $("h1=Mondes").waitForDisplayed();
  await $(`aria/Ouvrir ${name}`).click();
  await currentWorldButton(name).waitForDisplayed();
}

/** Text of the gallery counter ("2 / 3"), or null. */
const counter = () =>
  browser.execute(
    () =>
      [...document.querySelectorAll("figure span[aria-hidden]")]
        .map((span) => span.textContent?.trim() ?? "")
        .find((text) => /^\d+ \/ \d+$/.test(text)) ?? null,
  );

/** Alt texts of the images shown in the card's blocks. */
const shownImage = () =>
  browser.execute(
    () => document.querySelector<HTMLImageElement>("section figure > div.group img")?.alt ?? null,
  );

/** Opens the menu of block `index` (1-based) and picks `entry`. */
async function blockMenu(index: number, entry: string) {
  await $("[role=menu]").waitForExist({ reverse: true });
  const trigger = await $(`button[aria-label="Actions du bloc ${index}"]`);
  await trigger.scrollIntoView({ block: "center" });
  await trigger.waitForClickable();
  await trigger.click();
  const item = await $(`//*[@role="menuitem"][normalize-space()="${entry}"]`);
  await item.waitForDisplayed();
  await item.click();
  await $("[role=menu]").waitForExist({ reverse: true });
}

/**
 * Whether the text blocks (blocks 2 and 3, after the gallery) are in the
 * same list item, and its flex direction.
 */
const line = () =>
  browser.execute(() => {
    const first = document.querySelector('[aria-label="Bloc de texte 2"]')?.closest("li");
    const second = document.querySelector('[aria-label="Bloc de texte 3"]')?.closest("li");
    return {
      shared: first !== null && first !== undefined && first === second,
      direction: first ? getComputedStyle(first).flexDirection : null,
    };
  });

describe("M3: image galleries, blocks side by side, library and storage", () => {
  it("adds three images to an image block at once", async () => {
    await createWorld(FIRST);
    await openTab("World");
    await createCard("Lieu", "Fondcombe");

    await $("button=Ajouter un bloc").click();
    await $('//*[@role="menuitem"][normalize-space()="Image"]').click();
    const dialog = await $('[role="dialog"]');
    await dialog.waitForDisplayed();
    await pickNext([image("vallee.png"), image("maison.png"), image("pont.png")]);
    await $("button=Importer une image").click();
    const add = await $("button=Ajouter 3 images");
    await add.waitForEnabled({ timeoutMsg: "the three imported images were not ticked" });
    await add.click();

    await browser.waitUntil(async () => (await counter()) === "1 / 3", {
      timeoutMsg: `gallery counter: ${await counter()}`,
    });
  });

  it("goes through the images with the arrows, the thumbnails and the keyboard", async () => {
    await $("aria/Image suivante").click();
    await browser.waitUntil(async () => (await counter()) === "2 / 3");
    await $('button[aria-label^="Image 3 sur 3"]').click();
    await browser.waitUntil(async () => (await counter()) === "3 / 3");

    // One stop of Tab on the thumbnails: Home goes back to the first.
    await $('button[aria-label^="Image 3 sur 3"]').click();
    await browser.keys("Home");
    await browser.waitUntil(async () => (await counter()) === "1 / 3");
    await browser.keys("ArrowRight");
    await browser.waitUntil(async () => (await counter()) === "2 / 3");

    const caption = await $("aria/Légende de l'image 2");
    await caption.setValue("La maison d'Elrond");
    await browser.waitUntil(async () => (await shownImage()) === "La maison d'Elrond");
    await browser.pause(1200);
  });

  it("puts two text blocks side by side and resizes them", async () => {
    for (const text of ["À gauche", "À droite"]) {
      await $("[role=menu]").waitForExist({ reverse: true });
      await $("button=Ajouter un bloc").click();
      await $('//*[@role="menuitem"][normalize-space()="Texte"]').click();
      await $("[role=menu]").waitForExist({ reverse: true });
      await browser.keys(text);
    }

    // Blocks: 1 the gallery, 2 and 3 the texts.
    await blockMenu(3, "Placer à côté du bloc précédent");
    await browser.waitUntil(async () => (await line()).shared, {
      timeoutMsg: "the two text blocks are not on one line",
    });
    expect((await line()).direction).toBe("row");

    const border = await $("aria/Largeur du bloc 2");
    await border.click();
    await browser.keys("ArrowRight");
    await browser.waitUntil(async () => (await border.getAttribute("aria-valuenow")) === "60");
    await browser.pause(1200);
  });

  it("keeps the gallery and the line after reopening the world", async () => {
    await reopenWorld(FIRST);
    await openTab("World");
    await openCard("Fondcombe");

    await browser.waitUntil(async () => (await counter()) === "1 / 3", {
      timeoutMsg: `gallery after reopening: ${await counter()}`,
    });
    await $('button[aria-label^="Image 2 sur 3"]').click();
    await browser.waitUntil(async () => (await shownImage()) === "La maison d'Elrond", {
      timeoutMsg: "the caption of image 2 was not kept",
    });
    await browser.waitUntil(async () => (await line()).shared, {
      timeoutMsg: "the line of blocks was not kept",
    });
    expect(await $("aria/Largeur du bloc 2").getAttribute("aria-valuenow")).toBe("60");
  });

  it("stacks the blocks of a line when the content gets narrow", async () => {
    // The window is at least 1024 px wide: the content narrows when the
    // sidebar is widened (its handle dragged to the right).
    const handle = await $('[aria-label="Redimensionner la barre latérale"]');
    const dragHandle = (x: number) =>
      browser
        .action("pointer")
        .move({ origin: handle })
        .down()
        .move({ origin: handle, x: x / 2, y: 0, duration: 150 })
        .move({ origin: handle, x, y: 0, duration: 150 })
        .up()
        .perform();
    await dragHandle(260);
    await browser.waitUntil(async () => (await line()).direction === "column", {
      timeoutMsg: `still ${(await line()).direction} with a wide sidebar (blocks ${await browser.execute(
        () => document.querySelector("ul.\\@container")?.clientWidth,
      )} px)`,
    });
    expect((await line()).shared).toBe(true);
    await dragHandle(-260);
    await browser.waitUntil(async () => (await line()).direction === "row", {
      timeoutMsg: "the line did not come back with a narrow sidebar",
    });
  });

  it("adds an image of the world to the BuilderZ library", async () => {
    await openTab("Home");
    await $("=Médiathèque").click();
    await $("h1=Médiathèque").waitForDisplayed();
    const actions = await $('button[aria-label="Actions pour vallee.png"]');
    await actions.click();
    await $('//*[@role="menuitem"][normalize-space()="Ajouter à la bibliothèque"]').click();
    await $("p*=est dans la bibliothèque BuilderZ").waitForDisplayed();
  });

  it("reuses that image in another world, copied into it", async () => {
    await $("button=Mondes").click();
    await $("h1=Mondes").waitForDisplayed();
    await createWorld(SECOND);
    await openTab("World");
    await createCard("Lieu", "Armenelos");
    await $("button=Ajouter un bloc").click();
    await $('//*[@role="menuitem"][normalize-space()="Image"]').click();
    await $('[role="dialog"]').waitForDisplayed();
    await $('//*[@role="tab"][normalize-space()="Bibliothèque BuilderZ"]').click();
    await $('//*[@role="option"][normalize-space()="vallee.png"]').click();
    await $("button=Ajouter 1 image").click();
    await browser.waitUntil(async () => (await shownImage()) !== null, {
      timeoutMsg: "the library image did not show in the block",
    });

    await openTab("Home");
    await $("=Médiathèque").click();
    await $('button[aria-label="Actions pour vallee.png"]').waitForDisplayed({
      timeoutMsg: "the image was not copied into the second world",
    });
  });

  it("lists the library in the app settings", async () => {
    await $("aria/Réglages").click();
    await $('//*[@role="dialog"]//img[@alt="vallee.png"]').waitForDisplayed();
    await $("span*=1 image ·").waitForDisplayed();
    await browser.keys("Escape");
  });

  it("shows the space of the world and refuses an import beyond its limit", async () => {
    await currentWorldButton(SECOND).click();
    await $('//*[@role="tab"][normalize-space()="Médias"]').click();
    await $("dt=Total du monde").waitForDisplayed();
    await $("dt=Place libre sur le disque").waitForDisplayed();

    await $('//*[@role="dialog"]//button[@role="switch"]').click();
    const value = await $('//*[@role="dialog"]//input[@inputmode="decimal"]');
    await value.waitForDisplayed();
    await value.setValue("10");
    await $('//*[@role="dialog"]//button[@role="combobox"]').click();
    await $('//*[@role="option"][normalize-space()="Mo"]').click();
    await $("button=Appliquer").click();
    await $("p*=de la limite · ").waitForDisplayed();
    await browser.keys("Escape");

    // A file of 11 MB cannot fit under a 10 MB limit.
    await pickNext([image("carte-geante.png", 11 * 1024 * 1024)]);
    await $("button=Importer").click();
    await $("p*=atteint la limite de place choisie").waitForDisplayed({
      timeoutMsg: "the import beyond the limit was not refused",
    });
    expect(await $('button[aria-label="Actions pour carte-geante.png"]').isExisting()).toBe(false);
  });
});
