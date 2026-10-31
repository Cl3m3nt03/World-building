/**
 * V2-3.3b (#482, ADR 0014): the « Sélection » and « Date » properties, on a
 * card: choices listed on the property, picked as chips, renamed without
 * losing the values; a date of the world's calendar.
 */

import { createCard, createWorld } from "../helpers";

const WORLD = "Fiches";

const popover = () => $('[data-slot="popover-content"]');
const properties = () => $('section[aria-label="Propriétés"]');

/** Adds a property to the open card; its window then opens to set it up. */
async function addProperty(label: string, kind: string) {
  await properties().$("button=Ajouter une propriété").click();
  const name = await popover().$("input");
  await name.waitForDisplayed();
  await name.setValue(label);
  await popover().$(`button=${kind}`).click();
  await $(`aria/Modifier la propriété ${label}`).waitForDisplayed();
}

async function closeWindow() {
  await browser.keys("Escape");
  await popover().waitForExist({ reverse: true });
}

describe("V2-3.3b: select and date properties", () => {
  before(async () => {
    await $("h1=Mondes").waitForDisplayed({ timeout: 30_000 });
    await createWorld(WORLD);
    await createCard("Personnage", "Aragorn");
  });

  it("lists choices on a select property and picks one on the card", async () => {
    await addProperty("Statut", "Sélection");
    await $("aria/Ajouter un choix").waitForDisplayed();
    for (const choice of ["Vivant", "Mort"]) {
      await $("input[placeholder='Ajouter un choix']").setValue(choice);
      await browser.keys("Enter");
      await $(`aria/Nom du choix ${choice}`).waitForDisplayed();
    }
    await closeWindow();

    await $("aria/Choisir pour Statut").click();
    await $('//*[@role="menuitemradio"][normalize-space()="Vivant"]').click();
    await properties().$("li*=Vivant").waitForDisplayed();
  });

  it("keeps the value when a choice is renamed", async () => {
    await $("aria/Modifier la propriété Statut").click();
    const name = await $("aria/Nom du choix Vivant");
    await name.waitForDisplayed();
    // Not setValue: its clear leaves the field, and an empty name goes back to the old one.
    await name.click();
    await browser.keys(["Control", "a"]);
    await browser.keys("En vie");
    await browser.keys("Enter");
    await $("aria/Nom du choix En vie").waitForDisplayed();
    await closeWindow();

    await properties().$("li*=En vie").waitForDisplayed();
  });

  it("asks before removing a choice a card holds, then takes it off the card", async () => {
    await $("aria/Modifier la propriété Statut").click();
    await $("aria/Retirer le choix En vie").click();
    const alert = await popover().$('[role="alert"]');
    await alert.waitForDisplayed();
    await expect(alert).toHaveText(expect.stringContaining("1 fiche le perdra"));
    await alert.$("button=Retirer").click();
    await $("aria/Nom du choix En vie").waitForExist({ reverse: true });
    await closeWindow();

    await properties().$("li*=En vie").waitForExist({ reverse: true });
  });

  it("gives a date in the world's calendar", async () => {
    await addProperty("Naissance", "Date");
    await closeWindow();

    await $("aria/Naissance : aucune date").click();
    const year = await $("aria/Année");
    await year.waitForDisplayed();
    await year.setValue("298");
    await popover().$("button=OK").click();
    await popover().waitForExist({ reverse: true });

    await $("aria/Naissance : 298").waitForDisplayed();
  });
});
