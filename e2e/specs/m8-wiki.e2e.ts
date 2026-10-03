/**
 * M8 scenarios (docs/roadmap/M8-wiki.md, ADR 0008):
 * - a card made visible in the wiki, then hidden;
 * - a text written from the wiki, found in World;
 * - a theme chosen for the wiki, kept after a relaunch;
 * - the wiki exported as a site that needs no network, with its search.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCard, createWorld, currentWorldButton, openTab, sidebarItem } from "../helpers";

const WORLD = "Eldefleur";

type Invoke = { invoke: (command: string, args?: object) => Promise<unknown> };
const invoke = <T>(command: string, args: object = {}) =>
  browser.execute(
    (c, a) =>
      (window as unknown as { __TAURI_INTERNALS__: Invoke }).__TAURI_INTERNALS__.invoke(c, a),
    command,
    args,
  ) as Promise<T>;

const wikiTab = () => $('//*[@role="tab"][@aria-label="Wiki"]');
const menuItem = (name: string) =>
  $(`//*[starts-with(@role, "menuitem")][normalize-space()="${name}"]`);

/** The next native file dialog returns `result` (see src/lib/dialogs.ts). */
async function pickNext(result: string) {
  await browser.execute((value) => {
    const page = window as Window & { __bzE2eDialogAnswers?: string[] };
    page.__bzE2eDialogAnswers = [...(page.__bzE2eDialogAnswers ?? []), value];
  }, result);
}

/** A 2×2 PNG, written once in BUILDERZ_HOME. */
function fixtureImage(): string {
  const home = process.env.BUILDERZ_HOME;
  if (!home) throw new Error("BUILDERZ_HOME is not set (see e2e/wdio.conf.ts)");
  const file = path.join(home, "fixtures-m8", "alvar.png");
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

/** Right click on a row of the sidebar, again if a render replaced it meanwhile. */
async function rightClick(title: string) {
  await browser.waitUntil(
    async () => {
      try {
        await sidebarItem(title).click({ button: "right" });
        return true;
      } catch {
        return false;
      }
    },
    { timeoutMsg: `could not right click ${title}` },
  );
}

/**
 * Opens a card from the sidebar. A card visible in the wiki has its row read
 * "Alvar (visible dans le wiki)": the row is found by the start of its text.
 */
async function openWikiCard(title: string) {
  await $(`//aside//*[@role="treeitem"][starts-with(normalize-space(), "${title}")]`).click();
  await browser.waitUntil(async () => (await $("aria/Nom de la carte").getValue()) === title, {
    timeoutMsg: `the card ${title} did not open`,
  });
}

/** Opens a page of the wiki from its bar's « Pages » menu. */
async function openPage(name: string) {
  await $("button=Pages").click();
  await menuItem(name).click();
  await $(`article[aria-label="${name}"]`).waitForDisplayed({
    timeoutMsg: `the wiki page of ${name} did not open`,
  });
}

describe("M8: the wiki", () => {
  const cards: Record<string, string> = {};

  it("shows a card in the wiki once marked visible, and not once hidden", async () => {
    await createWorld(WORLD);
    await openTab("World");
    for (const name of ["Alvar", "Apex"]) await createCard("Personnage", name);
    for (const card of await invoke<{ id: string; title: string }[]>("list_cards", {
      trashed: false,
    })) {
      cards[card.title] = card.id;
    }

    await rightClick("Alvar");
    await menuItem("Visible dans le wiki").click();
    await wikiTab().click();
    await openPage("Alvar");

    // Hidden from the card's own menu, in World: the wiki has no page left.
    await openTab("World");
    await openWikiCard("Alvar");
    await $("aria/Actions de la carte").click();
    await menuItem("Visible dans le wiki").click();
    await wikiTab().click();
    await $("p=Le wiki n'a pas encore de page").waitForDisplayed({
      timeoutMsg: "the hidden card was still in the wiki",
    });
    expect(await invoke<unknown[]>("wiki_pages")).toHaveLength(0);
  });

  it("saves a text written from the wiki in the card, as World shows it", async () => {
    const block = {
      id: "b1",
      type: "text",
      doc: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Ami de " },
              { type: "mention", attrs: { id: cards.Apex, label: "Apex" } },
              { type: "text", text: "." },
            ],
          },
        ],
      },
    };
    await invoke("set_card_content", { id: cards.Alvar, content: JSON.stringify([block]) });
    const image = await invoke<{ asset: { id: string } }>("import_asset", { path: fixtureImage() });
    await invoke("set_card_image", { id: cards.Alvar, assetId: image.asset.id });
    for (const id of [cards.Alvar, cards.Apex]) {
      await invoke("set_wiki_visible", { id, visible: true });
    }
    // Written straight to the world: the page reads it again.
    await browser.refresh();
    await openPage("Alvar");

    const text = await $("aria/Bloc de texte 1");
    await text.click();
    await browser.keys(["Control", "End"]);
    await browser.keys(" Écrit depuis le wiki.");
    await browser.waitUntil(
      async () =>
        (await invoke<string>("get_card_content", { id: cards.Alvar })).includes(
          "Écrit depuis le wiki",
        ),
      { timeoutMsg: "the text written in the wiki was not saved" },
    );

    await openTab("World");
    await openWikiCard("Alvar");
    await browser.waitUntil(
      async () => (await $("aria/Bloc de texte 1").getText()).includes("Écrit depuis le wiki."),
      { timeoutMsg: "World did not show the text written in the wiki" },
    );
  });

  it("keeps the wiki's theme after a relaunch, without changing the app's", async () => {
    const appTheme = await browser.execute(() => document.documentElement.dataset.theme);
    await wikiTab().click();
    await $("button=Style du site").click();
    await $('//*[@role="dialog"]//button[normalize-space()="Nuit"]').click();
    await browser.waitUntil(
      async () =>
        (await invoke<{ theme: { preset?: string } }>("wiki_settings")).theme.preset === "night",
      { timeoutMsg: "the theme was not saved" },
    );
    await browser.keys("Escape");

    await browser.reloadSession();
    const open = await $(`aria/Ouvrir ${WORLD}`);
    await open.waitForDisplayed({ timeout: 30_000 });
    await open.click();
    await currentWorldButton(WORLD).waitForDisplayed();
    await wikiTab().click();
    const wiki = await $("[data-wiki]");
    await wiki.waitForDisplayed();
    expect(await wiki.getAttribute("data-wiki-scheme")).toBe("dark");
    expect(
      await browser.execute(() =>
        getComputedStyle(document.querySelector("[data-wiki]") as Element)
          .getPropertyValue("--wiki-background")
          .trim(),
      ),
    ).toBe("#14161f");
    // The app around keeps its own theme.
    expect(await browser.execute(() => document.documentElement.dataset.theme)).toBe(appTheme);
  });

  it("exports a site that opens offline, with its pages, images and search", async () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), "bz-wiki-"));
    await pickNext(parent);
    await $("button=Exporter le wiki").click();
    await $("button=Choisir le dossier…").click();
    await $("button=Ouvrir le dossier").waitForDisplayed({
      timeout: 30_000,
      timeoutMsg: "the export did not finish",
    });
    await browser.keys("Escape");

    const site = path.join(parent, `${WORLD} - wiki`);
    expect(readdirSync(site).sort()).toEqual([
      "assets",
      "fonts.css",
      "index.html",
      "pages",
      "search.js",
      "site.js",
      "style.css",
    ]);
    expect(readdirSync(path.join(site, "assets"))).toHaveLength(1);
    expect(readdirSync(path.join(site, "pages")).sort()).toEqual(
      [`${cards.Alvar}.html`, `${cards.Apex}.html`].sort(),
    );

    // Nothing is fetched from the network.
    for (const file of ["index.html", "style.css", "site.js", "fonts.css"]) {
      expect(readFileSync(path.join(site, file), "utf8")).not.toMatch(/https?:\/\//);
    }
    // Every link opens a file of the site.
    for (const file of [
      "index.html",
      ...readdirSync(path.join(site, "pages")).map((p) => `pages/${p}`),
    ]) {
      const html = readFileSync(path.join(site, file), "utf8");
      for (const [, target] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        expect(
          existsSync(path.resolve(path.dirname(path.join(site, file)), target as string)),
        ).toBe(true);
      }
    }
    // The search knows the text, and the mention of Apex links its page.
    expect(readFileSync(path.join(site, "search.js"), "utf8")).toContain("Écrit depuis le wiki");
    expect(readFileSync(path.join(site, "pages", `${cards.Alvar}.html`), "utf8")).toContain(
      `<a class="mention" href="../pages/${cards.Apex}.html">Apex</a>`,
    );
  });
});
