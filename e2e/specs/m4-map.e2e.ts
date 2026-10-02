import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createCard, createWorld, currentWorldButton, openCard, openTab } from "../helpers";

/**
 * M4 scenarios (docs/roadmap/M4-map.md, 4.11), the acceptance criteria of
 * docs/features/03-map.md:
 * - a map created on an image, a plain pin and a card's pin;
 * - a zone of 10 vertices closed on its first point and linked to a card;
 * - an arched text;
 * - hiding a layer hides its content;
 * - a new background keeps what is on the map;
 * - undo / redo;
 * - everything kept after reopening the world, and the card's backlink.
 */

const WORLD = "Beleriand";

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

/** A valid PNG named `name`, distinct from the others (bytes after its end change its hash). */
function image(name: string): string {
  const file = path.join(builderzHome(), "fixtures-m4", name);
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, Buffer.concat([PNG, Buffer.from(name)]));
  }
  return file;
}

/** Replaces the value of a React text field (select all, then type). */
async function typeOver(selector: string, value: string) {
  const field = await $(selector);
  await field.waitForDisplayed();
  await field.click();
  await browser.keys(["Control", "a"]);
  await browser.keys(value);
}

/** The next native file dialog returns `result` (see src/lib/dialogs.ts). */
async function pickNext(result: string | string[]) {
  await browser.execute((value) => {
    const page = window as Window & { __bzE2eDialogAnswers?: (string | string[])[] };
    page.__bzE2eDialogAnswers = [...(page.__bzE2eDialogAnswers ?? []), value];
  }, result);
}

const mapArea = () => $('[role="application"][aria-label^="Map "]');

/** Clicks the map at (dx, dy) px from its centre. */
async function clickMap(dx: number, dy: number) {
  await browser
    .action("pointer")
    .move({ origin: await mapArea(), x: Math.round(dx), y: Math.round(dy) })
    .down()
    .up()
    .perform();
  await browser.pause(80);
}

const pinNamed = (name: string) => $(`[aria-label="${name}"].bz-map-pin`);

/** Ids of the pins, zones and texts the map draws, by accessible name. */
const drawn = () =>
  browser.execute(() =>
    [...document.querySelectorAll(".bz-map-pin[aria-label], path[aria-label]")].map((element) =>
      element.getAttribute("aria-label"),
    ),
  );

describe("M4: the map", () => {
  it("creates a world with a card, then a map on an image", async () => {
    await createWorld(WORLD);
    await openTab("World");
    await createCard("Lieu", "Gondor");

    await $("aria/Nouvelle map").click();
    await $('[role="dialog"]').waitForDisplayed();
    await pickNext(image("arda.png"));
    await $("button=Importer une image").click();
    await mapArea().waitForDisplayed({ timeoutMsg: "the new map did not open" });
    // The map opens on its overview: the image fills the area on one axis and
    // does not go beyond it on the other (#187).
    await browser.waitUntil(
      async () =>
        browser.execute(() => {
          const image = document.querySelector(".leaflet-image-layer")?.getBoundingClientRect();
          const area = document
            .querySelector('[role="application"][aria-label^="Map "]')
            ?.getBoundingClientRect();
          if (!image || !area) return false;
          const fits = image.width <= area.width + 1 && image.height <= area.height + 1;
          const fills = image.width >= area.width * 0.9 || image.height >= area.height * 0.9;
          return fits && fills;
        }),
      { timeoutMsg: "the new map does not open on the whole image" },
    );
    await typeOver("aria/Nom de la map", "Arda des Valar");
    await browser.keys("Enter");
    await browser.waitUntil(
      async () =>
        (await browser.execute(() =>
          [...document.querySelectorAll("aside [role=treeitem]")].some(
            (item) => item.textContent?.trim() === "Arda des Valar",
          ),
        )) === true,
      { timeoutMsg: "the map was not renamed in the tree" },
    );
  });

  it("puts a plain pin and a card's pin", async () => {
    await $("button=Ajouter un pin").click();
    await pinNamed("Pin Repère").waitForExist();
    await typeOver("aria/Libellé", "Minas Tirith");
    await pinNamed("Pin Minas Tirith").waitForExist();

    await $("button=Ajouter une carte").click();
    await $('//*[@role="option"][contains(normalize-space(), "Gondor")]').click();
    await pinNamed("Pin de la carte Gondor").waitForExist();
  });

  it("traces a zone of 10 vertices, closes it on its first point and links it to a card", async () => {
    await $("button=Tracer une zone").click();
    const radius = 90;
    const points = Array.from({ length: 10 }, (_, i) => [
      radius * Math.cos((i / 10) * Math.PI * 2),
      radius * Math.sin((i / 10) * Math.PI * 2),
    ]);
    for (const [x, y] of points) await clickMap(x as number, y as number);
    await $("p*=10 sommets").waitForDisplayed();
    // Back on the first vertex: it closes the shape.
    await clickMap(points[0]?.[0] as number, points[0]?.[1] as number);
    await $("h2=Zone").waitForDisplayed({ timeoutMsg: "the zone did not close" });

    await typeOver("aria/Label", "Mordor");
    await $("button=Lier à une carte").click();
    await $('//*[@role="option"][contains(normalize-space(), "Gondor")]').click();
    await $("a*=Gondor").waitForDisplayed();
    await browser.waitUntil(async () => (await drawn()).includes("Zone Mordor"));
  });

  it("places an arched text", async () => {
    await $("button=Ajouter un texte").click();
    await clickMap(0, -140);
    const field = await $("aria/Texte");
    await field.waitForDisplayed();
    await browser.keys("Royaumes");
    const arc = await $("input[type=range][id$=-arc]");
    await browser.execute((input) => {
      const element = input as unknown as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(element, "0.5");
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, arc);
    await $("label*=Courbure : 50").waitForDisplayed();
    await pinNamed("Texte Royaumes").waitForExist();
  });

  it("hides the content of a hidden layer", async () => {
    await $("aria/Masquer le calque Calque 1").click();
    await browser.waitUntil(async () => (await drawn()).length === 0, {
      timeoutMsg: `still drawn: ${(await drawn()).join(", ")}`,
    });
    await $("aria/Afficher le calque Calque 1").click();
    await browser.waitUntil(async () => (await drawn()).length === 4);
  });

  it("undoes and redoes", async () => {
    // Keyboard: the pin focused, Delete removes it.
    await browser.execute(
      (pin) => (pin as unknown as HTMLElement).focus(),
      await pinNamed("Pin Minas Tirith"),
    );
    await browser.keys("Delete");
    await browser.waitUntil(async () => !(await drawn()).includes("Pin Minas Tirith"));
    await $("aria/Annuler (Ctrl+Z)").click();
    await pinNamed("Pin Minas Tirith").waitForExist();
    await $("aria/Rétablir (Ctrl+Y)").click();
    await browser.waitUntil(async () => !(await drawn()).includes("Pin Minas Tirith"));
    await $("aria/Annuler (Ctrl+Z)").click();
    await pinNamed("Pin Minas Tirith").waitForExist();
  });

  it("keeps everything on a new background", async () => {
    await $("button=Fond").click();
    await $('[role="dialog"]').waitForDisplayed();
    await pickNext(image("arda-2.png"));
    await $("button=Importer une image").click();
    await $('[role="dialog"]').waitForExist({ reverse: true });
    await browser.waitUntil(async () => (await drawn()).length === 4, {
      timeoutMsg: "the map's content is not drawn on the new background",
    });
    expect((await drawn()).sort()).toEqual(
      ["Pin Minas Tirith", "Pin de la carte Gondor", "Texte Royaumes", "Zone Mordor"].sort(),
    );
  });

  it("keeps the map after reopening the world, and the card shows it in its backlinks", async () => {
    await browser.pause(1500);
    await $("button=Mondes").click();
    await $("h1=Mondes").waitForDisplayed();
    await $(`aria/Ouvrir ${WORLD}`).click();
    await currentWorldButton(WORLD).waitForDisplayed();
    await openTab("World");
    await $('//aside//*[@role="treeitem"][normalize-space()="Arda des Valar"]').click();
    await mapArea().waitForDisplayed();
    await browser.waitUntil(async () => (await drawn()).length === 4, {
      timeoutMsg: `after reopening: ${(await drawn()).join(", ")}`,
    });

    await openCard("Gondor");
    const backlink = await $(
      '//section[@aria-label="Cité dans"]//a[contains(., "Arda des Valar")]',
    );
    await backlink.waitForDisplayed({ timeoutMsg: "the map is not in Gondor's backlinks" });
    await backlink.click();
    await mapArea().waitForDisplayed();
  });
});
