/**
 * M10 scenarios (docs/roadmap/M10-quill-avance.md, ADR 0010):
 * - a sound placed on a passage, found again after a reload;
 * - a reading setting kept;
 * - the story exported as ePub, PDF and Word, in the files chosen.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createWorld } from "../helpers";

// Each spec has its own world: they share one BUILDERZ_HOME.
const WORLD = "Lothlórien";
const STORY = "Le Chant";

type Invoke = { invoke: (command: string, args?: object) => Promise<unknown> };
const invoke = <T>(command: string, args: object = {}) =>
  browser.execute(
    (c, a) =>
      (window as unknown as { __TAURI_INTERNALS__: Invoke }).__TAURI_INTERNALS__.invoke(c, a),
    command,
    args,
  ) as Promise<T>;

const quillTab = () => $('//*[@role="tab"][@aria-label="Quill"]');
const chapterText = () => $("aria/Texte du chapitre");
const mode = (name: string) => $(`//*[@role="radio"][normalize-space()="${name}"]`);

function home(): string {
  const dir = process.env.BUILDERZ_HOME;
  if (!dir) throw new Error("BUILDERZ_HOME is not set (see e2e/wdio.conf.ts)");
  return dir;
}

/** A one-second WAV tone, written once in BUILDERZ_HOME. */
function fixtureSound(): string {
  const file = path.join(home(), "fixtures-m10", "Cloche.wav");
  if (existsSync(file)) return file;
  mkdirSync(path.dirname(file), { recursive: true });
  const rate = 8000;
  const samples = rate;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    wav.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 880 * i) / rate) * 8000), 44 + i * 2);
  }
  writeFileSync(file, wav);
  return file;
}

/** The next native file dialog returns `result` (see src/lib/dialogs.ts). */
async function answerNext(result: string) {
  await browser.execute((value) => {
    const page = window as Window & { __bzE2eDialogAnswers?: string[] };
    page.__bzE2eDialogAnswers = [...(page.__bzE2eDialogAnswers ?? []), value];
  }, result);
}

/** Selects `phrase` in the chapter's text and waits for the editor to take it. */
async function select(phrase: string) {
  await browser.execute((wanted) => {
    const text = document.querySelector('[aria-label="Texte du chapitre"]');
    if (!text) return;
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent?.indexOf(wanted) ?? -1;
      if (at >= 0) {
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + wanted.length);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        return;
      }
    }
  }, phrase);
  await browser.waitUntil(
    async () => (await browser.execute(() => window.getSelection()?.toString() ?? "")) === phrase,
    { timeoutMsg: `could not select "${phrase}"` },
  );
  // The editor reads the selection a beat later (selectionchange).
  await browser.pause(300);
}

async function storyId(): Promise<string> {
  const stories = await invoke<{ id: string; title: string }[]>("list_stories");
  const story = stories.find((candidate) => candidate.title === STORY);
  if (!story) throw new Error(`the story ${STORY} was not created`);
  return story.id;
}

describe("M10: Quill, advanced", () => {
  it("places a sound on a passage and finds it after a reload", async () => {
    await createWorld(WORLD);
    await invoke("import_asset", { path: fixtureSound() });
    await quillTab().click();
    await $("a=Nouvelle histoire").click();
    const title = await $("aria/Titre");
    await title.waitForDisplayed();
    await title.setValue(STORY);
    await $("button=Créer l'histoire").click();
    await chapterText().waitForDisplayed({ timeoutMsg: "the first chapter did not open" });
    await chapterText().click();
    // The editor reads where the caret is a beat after the click.
    await browser.pause(250);
    await browser.keys("Au loin, une cloche sonna minuit.");

    await mode("Audio").click();
    await chapterText().click();
    await browser.pause(300);
    await select("une cloche sonna");
    await $("button=Effet sonore").click();
    const sound = await $('//*[@role="dialog"]//button[normalize-space()="Cloche.wav"]');
    await sound.waitForDisplayed({ timeoutMsg: "the sound is not in the picker" });
    await sound.doubleClick();
    await chapterText()
      .$('.quill-sound[data-cue-kind="effect"]')
      .waitForDisplayed({ timeoutMsg: "the passage was not marked" });

    // Saved (half a second after the change), then read again.
    const id = await storyId();
    await browser.waitUntil(
      async () => {
        const outline = await invoke<{ chapters: { currentDraftId: string }[] }>("story_outline", {
          id,
        });
        const draft = await invoke<{ content: string }>("get_draft", {
          id: outline.chapters[0]?.currentDraftId,
        });
        return draft.content.includes("audioCue");
      },
      { timeoutMsg: "the sound's mark was not saved" },
    );
    await browser.refresh();
    await mode("Audio").waitForDisplayed();
    await mode("Audio").click();
    const marked = await chapterText().$('.quill-sound[data-cue-kind="effect"]');
    await marked.waitForDisplayed({ timeoutMsg: "the sound is gone after the reload" });
    expect(await marked.getText()).toBe("une cloche sonna");
    await $("aria/Effet sonore : Cloche.wav").waitForDisplayed();
  });

  it("keeps a reading setting of the story", async () => {
    await mode("Publier").click();
    const preview = await $('[aria-label^="Aperçu de lecture"]');
    await preview.waitForDisplayed();
    await $('//label[normalize-space()="Sépia"]').click();
    const id = await storyId();
    await browser.waitUntil(
      async () =>
        (await invoke<{ theme: string }>("reader_settings", { storyId: id })).theme === "sepia",
      { timeoutMsg: "the page theme was not kept" },
    );
    await browser.refresh();
    await $('[aria-label^="Aperçu de lecture"]').waitForDisplayed();
    // The sepia page (PAGE_THEMES.sepia).
    const page = await browser.execute(
      () =>
        getComputedStyle(document.querySelector('[aria-label^="Aperçu de lecture"]') as Element)
          .backgroundColor,
    );
    expect(page).toBe("rgb(242, 231, 208)");
  });

  it("exports the story as ePub, PDF and Word in the files chosen", async () => {
    await $('//*[@role="tab"][normalize-space()="Export"]').click();
    const folder = path.join(home(), "exports-m10");
    for (const [label, extension] of [
      ["ePub", "epub"],
      ["PDF", "pdf"],
      ["Word (DOCX)", "docx"],
    ] as const) {
      await $(`//label[starts-with(normalize-space(), "${label}")]`).click();
      const file = path.join(folder, `${STORY}.${extension}`);
      await answerNext(file);
      await $("button=Exporter").click();
      await browser.waitUntil(() => existsSync(file), {
        timeout: 30_000,
        timeoutMsg: `the ${label} file was not written`,
      });
      const head = readFileSync(file).subarray(0, 5).toString("latin1");
      // ePub and Word are zip archives; a PDF starts with its header.
      expect(head.startsWith(extension === "pdf" ? "%PDF-" : "PK")).toBe(true);
    }
  });
});
