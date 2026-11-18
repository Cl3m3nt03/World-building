/**
 * M9 scenarios (docs/roadmap/M9-quill.md, ADR 0009):
 * - a story created, a chapter written and kept, a paragraph centred;
 * - a note written on a passage and closed with Escape, kept (#609);
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
  chapters: { title: string; drafts: { id: string; name: string; wordCount: number }[] }[];
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

/**
 * Waits for the page's selection to be `text`. The editor reads a keyboard
 * selection a beat after it changes (selectionchange): typing at once would
 * hit the old one.
 */
async function waitForSelection(text: string) {
  await browser.waitUntil(
    async () => (await browser.execute(() => window.getSelection()?.toString() ?? "")) === text,
    { timeoutMsg: `the selection is not "${text}"` },
  );
  await browser.pause(150);
}

/**
 * Moves the caret with `keys` (or a click before), then gives the editor a
 * beat to read where it is: it reads the page's selection on
 * selectionchange, and a key that edits at once would use the old place.
 */
async function caret(keys?: string | string[]) {
  if (keys) await browser.keys(keys);
  await browser.pause(250);
}

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
    // The reload keeps the open story: back to the list from its link.
    await browser.refresh();
    await $("a=Histoires").click();
    await $(`//ul//a[contains(., "${STORY}")]`).click();
    await waitForText("Le roi entra dans la ville.");
  });

  it("centres a paragraph and keeps it in the draft", async () => {
    await chapterText().click();
    await caret();
    await caret(["Control", "Home"]);
    const centre = await $('//button[@aria-label="Centrer"]');
    await centre.click();
    await browser.waitUntil(async () => (await centre.getAttribute("aria-pressed")) === "true", {
      timeoutMsg: "the Centre button is not pressed",
    });
    expect(await chapterText().$("p").getAttribute("style")).toContain("text-align: center");
    await browser.waitUntil(
      async () => {
        const draft = (await outline()).chapters[0]?.drafts[0];
        if (!draft) return false;
        const saved = await invoke<{ content: string }>("get_draft", { id: draft.id });
        return saved.content.includes('"textAlign":"center"');
      },
      { timeoutMsg: "the alignment was not saved" },
    );
  });

  it("keeps a note closed with Escape", async () => {
    // On a line of its own: the drafts compared below rewrite the first.
    await chapterText().click();
    await caret();
    await caret(["Control", "End"]);
    await browser.keys("Enter");
    await browser.keys("La pluie tombait.");
    await browser.keys(["Shift", "Home"]);
    await waitForSelection("La pluie tombait.");
    await $("button=Ajouter une note").click();
    const field = await $("aria/Note");
    await field.waitForDisplayed({ timeoutMsg: "the new note did not open" });
    await field.click();
    await browser.keys("Le roi doute.");
    // Closed at once: the popover takes its field away without a blur.
    await browser.keys("Escape");
    await field.waitForDisplayed({ reverse: true, timeoutMsg: "the note did not close" });
    await browser.waitUntil(
      async () =>
        (await invoke<{ body: string }[]>("story_notes", { storyId: await storyId() })).some(
          (note) => note.body === "Le roi doute.",
        ),
      { timeoutMsg: "the note closed with Escape was not saved" },
    );

    // Opened again from its icon in the margin: the text is there.
    await $('//button[@aria-label="Note : Le roi doute."]').click();
    await browser.waitUntil(async () => (await $("aria/Note").getValue()) === "Le roi doute.", {
      timeoutMsg: "the note reopened without its text",
    });
    await browser.keys("Escape");
    await $("aria/Note").waitForDisplayed({ reverse: true });
  });

  it("creates a card from a selected passage, cited by the chapter", async () => {
    await chapterText().click();
    await caret();
    await caret(["Control", "End"]);
    await browser.keys("Enter");
    await browser.keys("Minas Tirith");
    await browser.keys(["Shift", "Home"]);
    await waitForSelection("Minas Tirith");
    await $("button=Créer une fiche").click();
    await $('//button[normalize-space()="Lieu"]').click();
    await chapterText()
      .$(".mention*=Minas Tirith")
      .waitForDisplayed({ timeoutMsg: "the passage did not become a mention" });

    await openTab("Monde");
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

    // The end of the first line rewritten with keys only: a selection
    // typed over would race with the editor reading it (#381).
    await chapterText().click();
    await caret();
    await caret(["Control", "Home"]);
    await caret("End");
    await browser.keys(Array(" dans la ville.".length).fill("Backspace"));
    await browser.keys(" vers la mer.");
    await browser.waitUntil(
      async () => {
        const draft = (await outline()).chapters[0]?.drafts.find(
          (candidate) => candidate.name === "Brouillon 2",
        );
        if (!draft) return false;
        const saved = await invoke<{ content: string }>("get_draft", { id: draft.id });
        return saved.content.includes("Le roi entra vers la mer.");
      },
      { timeoutMsg: "the second draft was not saved" },
    );

    await $("a=Comparer").click();
    const table = await $('[role="table"], table');
    await table.waitForDisplayed({ timeoutMsg: "the comparison did not open" });
    const removed = await table.$$("del").map((element) => element.getText());
    const added = await table.$$("ins").map((element) => element.getText());
    expect(removed.join(" ")).toContain("dans");
    expect(added.join(" ")).toContain("vers");
  });
});
