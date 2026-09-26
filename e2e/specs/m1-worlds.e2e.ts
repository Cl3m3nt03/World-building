import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * M1 scenarios (docs/roadmap/M1-mondes-et-interface.md, 1.14): several
 * worlds with their own state, preferences kept across launches, and a
 * missing world relocated.
 *
 * Native file dialogs cannot be driven through WebDriver: `pickNext` queues
 * the path the next dialog returns (e2e builds only, src/lib/dialogs.ts);
 * everything else goes through Rust.
 */

const FIRST = "Aldoria";
const SECOND = "Neonis";

function builderzHome(): string {
  const home = process.env.BUILDERZ_HOME;
  if (!home) throw new Error("BUILDERZ_HOME is not set (see e2e/wdio.conf.ts)");
  return home;
}

const worldsDir = () => path.join(builderzHome(), "worlds");

/** A 2×2 PNG, written once in BUILDERZ_HOME. */
function fixtureImage(): string {
  const file = path.join(builderzHome(), "fixtures", "aldoria.png");
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(
      file,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGNwSFgARAwQCgAhjgUBvM8p0wAAAABJRU5ErkJggg==",
        "base64",
      ),
    );
  }
  return file;
}

/** The next native file dialog returns `result` (see src/lib/dialogs.ts). */
async function pickNext(result: string) {
  await browser.execute((value) => {
    const page = window as Window & { __bzE2eDialogAnswers?: string[] };
    page.__bzE2eDialogAnswers = [...(page.__bzE2eDialogAnswers ?? []), value];
  }, result);
}

const currentWorldButton = (name: string) => $(`aria/Monde courant : ${name}. Modifier le monde`);

async function createWorld(name: string, genre?: string) {
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

/** Closes the only open dialog with Escape, once any other has finished closing. */
async function closeDialog() {
  const dialogs = async () => (await $$('[role="dialog"]')).length;
  await browser.waitUntil(async () => (await dialogs()) === 1, {
    timeoutMsg: "expected exactly one open dialog",
  });
  await browser.keys("Escape");
  await browser.waitUntil(async () => (await dialogs()) === 0, {
    timeoutMsg: "the dialog did not close",
  });
}

async function backToWorldList() {
  await $("button=Mondes").click();
  await $("h1=Mondes").waitForDisplayed();
}

/** Source of the full-screen backdrop image, or null for the default gradient. */
async function backdropSource(): Promise<string | null> {
  return browser.execute(
    () => document.querySelector<HTMLImageElement>("div[aria-hidden] > img")?.src ?? null,
  );
}

describe("M1: worlds, preferences and relocation", () => {
  it("starts on the world list", async () => {
    await $("h1=Mondes").waitForDisplayed({ timeout: 30_000 });
  });

  it("creates a first world and gives it a main image through the picker", async () => {
    await createWorld(FIRST);
    await expect($(`h1=Bienvenue dans ${FIRST}`)).toBeDisplayed();

    await currentWorldButton(FIRST).click();
    await $("button=Choisir une image").click();
    await pickNext(fixtureImage());
    await $("button=Importer une image").click();

    await $("button=Changer d'image").waitForDisplayed();
    await browser.waitUntil(async () => (await backdropSource())?.includes("bzasset") ?? false, {
      timeoutMsg: "the main image never became the backdrop",
    });
    await closeDialog();
  });

  it("creates a second world with another genre and no image", async () => {
    await backToWorldList();
    await createWorld(SECOND, "Science-fiction");

    await expect($(`h1=Bienvenue dans ${SECOND}`)).toBeDisplayed();
    await expect($("dd=Science-fiction")).toBeDisplayed();
    expect(await backdropSource()).toBeNull();
  });

  it("switches back to the first world and finds its state", async () => {
    await backToWorldList();
    // The list shows the first world's cached thumbnail.
    const firstCard = await $(`aria/Ouvrir ${FIRST}`);
    await expect(firstCard.$("img")).toBeExisting();

    await firstCard.click();
    await currentWorldButton(FIRST).waitForDisplayed();
    await expect($("dd=Fantasy")).toBeDisplayed();
    await browser.waitUntil(async () => (await backdropSource())?.includes("bzasset") ?? false);
  });

  it("keeps the language and theme after a relaunch", async () => {
    await backToWorldList();
    await $("aria/Réglages").click();
    await $("#theme-dark").click();
    await $("#language-en").click();
    await closeDialog();
    await $("h1=Worlds").waitForDisplayed();

    await browser.reloadSession();

    await $("h1=Worlds").waitForDisplayed({ timeout: 30_000 });
    expect(await browser.execute(() => document.documentElement.dataset.theme)).toBe("dark");

    // Back to the defaults for the other specs.
    await $("aria/Settings").click();
    await $("#theme-system").click();
    await $("#language-fr").click();
    await closeDialog();
    await $("h1=Mondes").waitForDisplayed();
  });

  it("flags a world whose folder moved, then relocates it", async () => {
    const moved = path.join(worldsDir(), `${SECOND} (déplacé)`);
    renameSync(path.join(worldsDir(), SECOND), moved);
    await browser.reloadSession();

    const card = await $(`aria/Relocaliser ${SECOND}`);
    await card.waitForDisplayed({ timeout: 30_000 });
    await expect($('//*[normalize-space()="Introuvable"]')).toBeDisplayed();

    await pickNext(moved);
    await card.click();

    // Back to a normal card, which opens the world from its new folder.
    const relocated = await $(`aria/Ouvrir ${SECOND}`);
    await relocated.waitForDisplayed();
    await relocated.click();
    await currentWorldButton(SECOND).waitForDisplayed();
    await expect($(`h1=Bienvenue dans ${SECOND}`)).toBeDisplayed();
  });
});
