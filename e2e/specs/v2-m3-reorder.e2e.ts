/**
 * V2-3.3c (#501): a type orders its default properties on the types screen,
 * every card of the type follows; a card orders its own properties only.
 */

import { createCard, createWorld, openTab } from "../helpers";

const WORLD = "Ordre";

const popover = () => $('[data-slot="popover-content"]');
const properties = () => $('section[aria-label="Propriétés"]');

async function addProperty(button: ReturnType<typeof $>, label: string, onCard = false) {
  await button.click();
  const name = await popover().$("input");
  await name.waitForDisplayed();
  await name.setValue(label);
  await browser.keys("Enter");
  await $(`aria/Modifier la propriété ${label}`).waitForDisplayed();
  if (onCard) {
    // The new property's window opens to set it up.
    await $('[data-slot="popover-content"][data-state="open"]').waitForDisplayed();
    await browser.keys("Escape");
  }
  await popover().waitForExist({ reverse: true });
}

/** Picks a property up with the keyboard and moves it up one row. */
async function pickUpAndRaise(label: string) {
  await browser.execute(
    (name) =>
      document
        .querySelector<HTMLElement>(`[aria-label^="Déplacer la propriété ${name} "]`)
        ?.focus(),
    label,
  );
  await browser.keys(" ");
  await browser.pause(150);
  await browser.keys("ArrowUp");
  await browser.pause(150);
}

/** Moves a property up one row: Space, arrow, Space. */
async function moveUp(label: string) {
  await pickUpAndRaise(label);
  await browser.keys(" ");
}

/** The accessible names starting with `prefix`, without it, in page order. */
const names = (prefix: string) =>
  browser.execute(
    (start) =>
      [...document.querySelectorAll(`[aria-label^="${start}"]`)].map((element) =>
        element.getAttribute("aria-label")?.slice(start.length),
      ),
    prefix,
  );

describe("V2-3.3c: reordering properties", () => {
  before(async () => {
    await $("h1=Mondes").waitForDisplayed({ timeout: 30_000 });
    await createWorld(WORLD);
  });

  it("orders a type's properties, and the new cards of the type follow", async () => {
    await openTab("Accueil");
    await $("button=Types").click();
    await $("aria/Nom du type").waitForDisplayed();
    const add = $("button=Ajouter une propriété");
    await addProperty(add, "Force");
    await addProperty(add, "Courage");

    // Escape cancels the move and leaves the types screen open.
    await pickUpAndRaise("Courage");
    await browser.keys("Escape");
    await browser.pause(300);
    await expect($("aria/Nom du type")).toBeDisplayed();
    const untouched = await names("Modifier la propriété ");
    expect(untouched.indexOf("Force")).toBeLessThan(untouched.indexOf("Courage"));

    await moveUp("Courage");
    await browser.waitUntil(
      async () => {
        const shown = await names("Modifier la propriété ");
        return shown.indexOf("Courage") < shown.indexOf("Force");
      },
      { timeoutMsg: "the type's properties were not reordered" },
    );
    await browser.keys("Escape");
    await $('[role="dialog"]').waitForExist({ reverse: true });

    await createCard("Personnage", "Aragorn");
    await properties().$('input[aria-label="Force"]').waitForDisplayed();
    const fields = await properties().$$("input");
    const labels = await fields.map((field) => field.getAttribute("aria-label"));
    expect(labels.indexOf("Courage")).toBeLessThan(labels.indexOf("Force"));
  });

  it("orders a card's own properties, and leaves its type's alone", async () => {
    const add = properties().$("button=Ajouter une propriété");
    await addProperty(add, "Épée", true);
    await addProperty(add, "Cheval", true);
    expect(await names("Déplacer la propriété ")).toEqual([
      "Épée (Espace, puis flèches)",
      "Cheval (Espace, puis flèches)",
    ]);

    await moveUp("Cheval");
    await browser.waitUntil(
      async () => (await names("Modifier la propriété ")).join() === "Cheval,Épée",
      { timeoutMsg: "the card's own properties were not reordered" },
    );
  });
});
