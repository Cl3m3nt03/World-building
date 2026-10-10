/**
 * M9 scenarios (docs/roadmap/M9-quill.md, ADR 0009):
 * - a story created, a chapter written and kept;
 * - a card created from a selected passage, found in the sidebar and in its
 *   « Cité dans »;
 * - two drafts compared.
 */

import { createWorld, openCard, openTab, sidebarItem } from "../helpers";

// Each spec has its own world: they share one BUILDERZ_HOME.
const WORLD = "Gondolin";
const STORY = "La Chute";

type Invoke = { invoke: (command: string, args?: object) => Promise<unknown> };
const invoke = <T>(command: string, args: object = {}) =>
  browser.execute(
    (c, a) =>
      (window as unknown as { __TAURI_INTERNALS__: Invoke }).__TAURI_INTERNALS__.invoke(c, a),
    command,
    args,
  ) as Promise<T>;

type Outline = {
  story: { wordCount: number };
  chapters: { title: string; drafts: { name: string; wordCount: number }[] }[];
};

const quillTab = () => $('//*[@role="tab"][@aria-label="Quill"]');
const chapterText = () => $("aria/Texte du chapitre");
const menuItem = (name: string) =>
  $(`//*[starts-with(@role, "menuitem")][normalize-space()="${name}"]`);

async function storyId(): Promise<string> {
  const stories = await invoke<{ id: string; title: string }[]>("list_stories");
  const story = stories.find((candidate) => candidate.title === STORY);
  if (!story) throw new Error(`the story ${STORY} was not created`);
  return story.id;
}

const outline = async () => invoke<Outline>("story_outline", { id: await storyId() });

/** Waits for the chapter's text, as the editor shows it, to include `text`. */
async function waitForText(text: string) {
  await browser.waitUntil(async () => (await chapterText().getText()).includes(text), {
    timeoutMsg: `the chapter does not show "${text}"`,
  });
}

describe("M9: Quill", () => {
  it("creates a story, writes its first chapter and keeps it", async () => {
    await createWorld(WORLD);
    await quillTab().click();
    await $("a=Nouvelle histoire").click();
    const title = await $("aria/Titre");
    await title.waitForDisplayed();
    await title.setValue(STORY);
    await $("button=Créer l'histoire").click();

    await chapterText().waitForDisplayed({ timeoutMsg: "the first chapter did not open" });
    await chapterText().click();
    await browser.keys("Le roi entra dans la ville.");
    await browser.waitUntil(async () => (await outline()).story.wordCount === 6, {
      timeoutMsg: "the chapter was not saved",
    });

    // Opened again from the list of stories, after a reload.
    await browser.refresh();
    await quillTab().click();
    await $(`//ul//a[contains(., "${STORY}")]`).click();
    await waitForText("Le roi entra dans la ville.");
  });

  it("creates a card from a selected passage, cited by the chapter", async () => {
    await chapterText().click();
    await browser.keys(["Control", "End"]);
    await browser.keys("Enter");
    await browser.keys("Minas Tirith");
    await browser.keys(["Shift", "Home"]);
    await $("button=Créer une carte").click();
    await $('//button[normalize-space()="Lieu"]').click();
    await chapterText()
      .$(".mention*=Minas Tirith")
      .waitForDisplayed({ timeoutMsg: "the passage did not become a mention" });

    await openTab("World");
    await sidebarItem("Minas Tirith").waitForDisplayed({
      timeoutMsg: "the new card is not in the sidebar",
    });
    await openCard("Minas Tirith");
    const backlink = await $(
      `//section[@aria-label="Cité dans"]//a[contains(., "Chapitre 1 — ${STORY}")]`,
    );
    await backlink.waitForDisplayed({ timeoutMsg: "the chapter is not in the card's backlinks" });
    await backlink.click();
    await waitForText("Minas Tirith");
  });

  it("compares two drafts of a chapter", async () => {
    await $("button=Nouveau brouillon").click();
    await menuItem("Copie du brouillon courant").click();
    const banner = await $('[role="note"]');
    await banner.waitForDisplayed({ timeoutMsg: "the copy did not open" });
    await waitForText("Le roi entra dans la ville.");

    await chapterText().click();
    await browser.keys(["Control", "Home"]);
    await browser.keys(["Shift", "End"]);
    await browser.keys("La reine quitta la ville.");
    await browser.waitUntil(
      async () =>
        (await outline()).chapters[0]?.drafts.some(
          (draft) => draft.name === "Brouillon 2" && draft.wordCount === 7,
        ),
      { timeoutMsg: "the second draft was not saved" },
    );

    await $("a=Comparer").click();
    const table = await $('[role="table"], table');
    await table.waitForDisplayed({ timeoutMsg: "the comparison did not open" });
    const removed = await table.$$("del").map((element) => element.getText());
    const added = await table.$$("ins").map((element) => element.getText());
    expect(removed.join(" ")).toContain("roi");
    expect(added.join(" ")).toContain("reine");
  });
});
