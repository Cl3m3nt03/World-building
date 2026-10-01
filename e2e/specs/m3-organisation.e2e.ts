/**
 * M3 scenarios (docs/roadmap/M3-organisation.md, 3.14), the acceptance
 * criteria of docs/features/02-organisation.md:
 * - Royaume › Ville › Taverne built by drag and drop; Royaume onto Taverne refused;
 * - a folder with an icon and a subfolder;
 * - three pins in a chosen order;
 * - a card found by an alias and by a word of its content;
 * - filtered on "Personnage" and sorted by name, then back to the manual order;
 * - the sidebar state (open folders, filters) kept by the world.
 */

import { createCard, createWorld, openTab, sidebarItem } from "../helpers";

const WORLD = "Arda";

/** The tree as "name level", in display order. */
async function rows(): Promise<string[]> {
  return browser.execute(() =>
    [...document.querySelectorAll("aside [role=treeitem]")].map(
      (item) => `${item.textContent} ${item.getAttribute("aria-level")}`,
    ),
  );
}

/**
 * Drags the row `from` onto `to`, at `where` of its height (0 top, 0.5
 * middle, 1 bottom); returns the drop indicator shown before releasing.
 */
async function drag(from: string, to: string, where: number): Promise<string | null> {
  const source = await sidebarItem(from);
  const target = await sidebarItem(to);
  const targetSize = await target.getSize();
  const yOffset = Math.round(targetSize.height * (where - 0.5));
  await browser
    .action("pointer")
    .move({ origin: source })
    .down()
    .pause(50)
    .move({ origin: source, x: 0, y: 10, duration: 100 })
    .move({ origin: target, x: 0, y: yOffset, duration: 300 })
    .pause(150)
    .move({ origin: target, x: 1, y: yOffset, duration: 50 })
    .pause(150)
    .perform(true);
  const indicator = await target.getAttribute("data-drop");
  await browser.action("pointer").up().perform();
  await browser.pause(400);
  return indicator;
}

/** Opens a row's menu (right click) and picks `entry`. */
async function menu(row: string, entry: string) {
  await (await sidebarItem(row)).click({ button: "right" });
  await $(`//*[@role="menuitem"][starts-with(normalize-space(), "${entry}")]`).click();
}

/** Clicks an entry of the open menu, scrolled into view first (long menus scroll). */
async function pick(role: string, name: string) {
  const entry = await $(`//*[@role="${role}"][normalize-space()="${name}"]`);
  await entry.waitForExist();
  await entry.scrollIntoView({ block: "center" });
  await entry.click();
}

/** Opens the "Filters and sort" menu, once the previous menu is gone. */
async function openViewMenu() {
  await $("[role=menu]").waitForExist({ reverse: true });
  await $('button[aria-label^="Filtres et tri"]').click();
  await $('[role=menu][data-state="open"]').waitForDisplayed();
}

const pins = () =>
  browser.execute(() =>
    [...document.querySelectorAll('[aria-labelledby="pinned-title"] a')].map((a) =>
      a.textContent?.trim(),
    ),
  );

describe("M3: organisation of the sidebar", () => {
  it("creates a world with a few cards", async () => {
    await createWorld(WORLD);
    await openTab("World");
    for (const [type, title] of [
      ["Lieu", "Royaume"],
      ["Lieu", "Ville"],
      ["Lieu", "Taverne"],
      ["Personnage", "Sam"],
      ["Personnage", "Aragorn"],
    ]) {
      await createCard(type as string, title as string);
    }
  });

  it("builds Royaume › Ville › Taverne by drag and drop, and refuses a cycle", async () => {
    expect(await drag("Ville", "Royaume", 0.5)).toBe("inside");
    expect(await drag("Taverne", "Ville", 0.5)).toBe("inside");
    await browser.waitUntil(async () => (await rows()).includes("Taverne 3"), {
      timeoutMsg: "Taverne is not under Ville",
    });
    const before = await rows();
    expect(await drag("Royaume", "Taverne", 0.5)).toBe("refused");
    expect(await rows()).toEqual(before);
  });

  it("makes a folder with an icon, and a subfolder", async () => {
    await $("aria/Nouveau dossier").click();
    const name = await $("aria/Nom du dossier");
    await name.waitForDisplayed();
    await browser.keys(["Personnages", "Enter"]);
    await sidebarItem("Personnages").waitForDisplayed();

    await menu("Personnages", "Changer l'icône");
    await $("aria/crown").click();
    await $("button=Terminé").click();
    await browser.waitUntil(
      async () =>
        (await (await sidebarItem("Personnages")).$("svg.lucide-crown").isExisting()) === true,
      { timeoutMsg: "the folder icon did not change" },
    );

    await menu("Personnages", "Nouveau sous-dossier");
    await $("aria/Nom du dossier").waitForDisplayed();
    await browser.keys(["Nobles", "Enter"]);
    await sidebarItem("Nobles").waitForDisplayed();
    expect(await rows()).toContain("Nobles 2");
  });

  it("keeps three pins in the order chosen", async () => {
    for (const title of ["Sam", "Aragorn", "Royaume"]) await menu(title, "Épingler");
    await browser.waitUntil(async () => (await pins()).length === 3);
    expect(await pins()).toEqual(["Sam", "Aragorn", "Royaume"]);
    // Royaume first, with the keyboard: Space, arrows, Space.
    await browser.execute(() =>
      document.querySelectorAll<HTMLElement>('[aria-labelledby="pinned-title"] a')[2]?.focus(),
    );
    await browser.keys(" ");
    await browser.pause(150);
    await browser.keys("ArrowLeft");
    await browser.pause(150);
    await browser.keys("ArrowLeft");
    await browser.pause(150);
    await browser.keys(" ");
    await browser.waitUntil(async () => (await pins())[0] === "Royaume", {
      timeoutMsg: "the pins were not reordered",
    });
    expect(await pins()).toEqual(["Royaume", "Sam", "Aragorn"]);
  });

  it("finds a card by an alias and by a word of its content", async () => {
    await (await sidebarItem("Aragorn")).click();
    await $("aria/Nouvel alias").setValue("Grands-Pas");
    await $("button=Ajouter").click();
    await (await sidebarItem("Taverne")).click();
    await $("button*=Commencez à écrire").click();
    await browser.keys("Le Poney Fringant, à Bree.");
    await browser.pause(1500);

    const search = await $("aria/Rechercher dans le monde");
    const results = () =>
      browser.execute(() =>
        [...document.querySelectorAll("[role=listbox] [role=option]")].map((o) =>
          o.textContent?.replace(/\s+/g, " ").trim(),
        ),
      );
    await search.setValue("grands");
    await browser.waitUntil(async () => (await results()).length === 1);
    expect((await results())[0]).toContain("Aragorn");
    await search.setValue("poney");
    await browser.waitUntil(async () => (await results())[0]?.startsWith("Taverne") === true, {
      timeoutMsg: "Taverne not found by its content",
    });
    await browser.keys("Escape");
    await $("aside [role=tree]").waitForDisplayed();
  });

  it("filters on Personnage, sorts by name, and comes back to the manual order", async () => {
    const manual = await rows();
    await openViewMenu();
    await pick("menuitemcheckbox", "Personnage");
    await pick("menuitemradio", "Nom");
    await browser.keys("Escape");
    await browser.waitUntil(async () => (await rows()).join("|") === "Aragorn 1|Sam 1", {
      timeoutMsg: `not filtered and sorted: ${(await rows()).join("|")}`,
    });
    await $("button=Ordre manuel").click();
    await browser.waitUntil(async () => (await rows()).join("|") === "Sam 1|Aragorn 1");
    await openViewMenu();
    await pick("menuitem", "Tout réinitialiser");
    await browser.waitUntil(async () => (await rows()).join("|") === manual.join("|"));
  });

  it("keeps the sidebar state with the world", async () => {
    // Personnages open (holds Nobles), a filter on Lieu.
    await openViewMenu();
    await pick("menuitemcheckbox", "Lieu");
    await browser.keys("Escape");
    await browser.pause(800);
    const before = await rows();

    await $("button=Mondes").click();
    await $("h1=Mondes").waitForDisplayed();
    await $(`aria/Ouvrir ${WORLD}`).click();
    await openTab("World");
    await browser.waitUntil(async () => (await rows()).join("|") === before.join("|"), {
      timeoutMsg: `state not kept: ${(await rows()).join("|")} instead of ${before.join("|")}`,
    });
    expect(await $('button[aria-label="Filtres et tri (actifs)"]').isExisting()).toBe(true);
  });
});
