/**
 * M7 scenarios (docs/roadmap/M7-canvas.md, 7.11), the acceptance criteria
 * of docs/features/06-canvas.md:
 * - three cards dragged from the sidebar, grouped in a section moved as one;
 * - a card renamed: its thumbnail follows;
 * - an image pasted: it goes to the media library;
 * - a note written in place;
 * - all of it the same after reopening the world.
 */

import { createCard, createWorld, currentWorldButton, openTab, sidebarItem } from "../helpers";

const WORLD = "Rohan";
const CANVAS = "Canvas sans nom";

type Element = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  link?: string | null;
  frameId?: string | null;
  fileId?: string | null;
  name?: string | null;
  customData?: { title?: string; text?: string };
  isDeleted?: boolean;
};

type Invoke = { invoke: (command: string, args?: object) => Promise<unknown> };

/** The canvas's scene as saved by the Rust side (live elements). */
const saved = () =>
  browser.execute(async (title) => {
    const internals = (window as unknown as { __TAURI_INTERNALS__: Invoke }).__TAURI_INTERNALS__;
    const tree = (await internals.invoke("document_tree")) as {
      documents: { id: string; title: string }[];
    };
    const document = tree.documents.find((candidate) => candidate.title === title);
    if (!document) return null;
    const canvas = (await internals.invoke("get_canvas", { id: document.id })) as { scene: string };
    return (JSON.parse(canvas.scene) as { elements: Element[] }).elements.filter(
      (element) => !element.isDeleted,
    );
  }, CANVAS);

/** The scene once saved (the editor waits a little). */
async function scene(): Promise<Element[]> {
  await browser.pause(1300);
  const elements = await saved();
  if (!elements) throw new Error("the canvas was not saved");
  return elements;
}

const surface = () => $(".excalidraw canvas.interactive");
const tool = (name: string) =>
  $(`//*[@role="toolbar"][@aria-label="Outils du canvas"]//button[@aria-label="${name}"]`);
const thumbnails = () => $$(".bz-canvas-card");

/** Where scene point (x, y) is in the window (Excalidraw's state, test builds only). */
const toWindow = (x: number, y: number) =>
  browser.execute(
    (sx, sy) => {
      const api = (
        window as unknown as {
          __bzExcalidraw: {
            getAppState: () => {
              scrollX: number;
              scrollY: number;
              zoom: { value: number };
              offsetLeft: number;
              offsetTop: number;
            };
          };
        }
      ).__bzExcalidraw;
      const state = api.getAppState();
      return {
        x: Math.round((sx + state.scrollX) * state.zoom.value + state.offsetLeft),
        y: Math.round((sy + state.scrollY) * state.zoom.value + state.offsetTop),
      };
    },
    x,
    y,
  );

/** Presses at (dx, dy) from the canvas's centre, drags to (tx, ty), releases. */
async function dragOnCanvas(dx: number, dy: number, tx: number, ty: number) {
  const canvas = await surface();
  await browser
    .action("pointer", { parameters: { pointerType: "mouse" } })
    .move({ origin: canvas, x: Math.round(dx), y: Math.round(dy) })
    .down()
    .move({
      origin: canvas,
      x: Math.round((dx + tx) / 2),
      y: Math.round((dy + ty) / 2),
      duration: 150,
    })
    .move({ origin: canvas, x: Math.round(tx), y: Math.round(ty), duration: 150 })
    .up()
    .perform();
  await browser.pause(300);
}

/** Drags the sidebar row `title` onto the canvas, (dx, dy) from its centre. */
async function dropCard(title: string, dx: number, dy: number) {
  const row = await sidebarItem(title);
  await browser
    .action("pointer", { parameters: { pointerType: "mouse" } })
    .move({ origin: row })
    .down()
    .pause(50)
    .move({ origin: row, x: 0, y: 10, duration: 100 })
    .move({ origin: await surface(), x: Math.round(dx), y: Math.round(dy), duration: 400 })
    .pause(150)
    .up()
    .perform();
  await browser.pause(400);
}

describe("M7: the canvas", () => {
  let width = 0;
  let height = 0;

  it("creates a world with three cards, then a canvas", async () => {
    await createWorld(WORLD);
    await openTab("World");
    await createCard("Personnage", "Théoden");
    await createCard("Personnage", "Éomer");
    await createCard("Lieu", "Edoras");
    await $("aria/Nouveau document (map, graph, arbre, canvas…)").click();
    await $('//*[@role="menuitem"][normalize-space()="Nouveau canvas"]').click();
    await surface().waitForDisplayed({ timeout: 30000, timeoutMsg: "the canvas did not open" });
    await browser.waitUntil(async () => browser.execute(() => "__bzExcalidraw" in window), {
      timeoutMsg: "Excalidraw did not start",
    });
    ({ width, height } = await (await surface()).getSize());
  });

  it("groups three dropped cards in a section that moves them as one", async () => {
    // A section over most of the view.
    await tool("Section").click();
    await dragOnCanvas(-width * 0.4, -height * 0.32, width * 0.4, height * 0.3);
    const [section] = (await scene()).filter((element) => element.type === "frame");
    expect(section?.name).toBe("Section 1");

    await dropCard("Théoden", -width * 0.25, -height * 0.1);
    await dropCard("Éomer", 0, -height * 0.1);
    await dropCard("Edoras", width * 0.25, -height * 0.1);
    const cards = (await scene()).filter((element) => element.type === "embeddable");
    expect(cards).toHaveLength(3);
    expect(cards.every((card) => card.frameId === section?.id)).toBe(true);
    await browser.waitUntil(async () => (await thumbnails().length) === 3, {
      timeoutMsg: "the thumbnails did not show",
    });

    // Drag the section by its name, 60 px right and 40 px down.
    if (!section) throw new Error("no section");
    const name = await toWindow(section.x + 20, section.y - 8);
    await browser
      .action("pointer", { parameters: { pointerType: "mouse" } })
      .move({ origin: "viewport", x: name.x, y: name.y })
      .down()
      .move({ origin: "viewport", x: name.x + 30, y: name.y + 20, duration: 150 })
      .move({ origin: "viewport", x: name.x + 60, y: name.y + 40, duration: 150 })
      .up()
      .perform();
    const after = await scene();
    const moved = after.find((element) => element.id === section.id);
    const zoom = await browser.execute(
      () =>
        (
          window as unknown as {
            __bzExcalidraw: { getAppState: () => { zoom: { value: number } } };
          }
        ).__bzExcalidraw.getAppState().zoom.value,
    );
    const dx = (moved?.x ?? 0) - section.x;
    expect(Math.round(dx)).toBe(Math.round(60 / zoom));
    for (const card of cards) {
      const now = after.find((element) => element.id === card.id);
      expect(Math.round((now?.x ?? 0) - card.x)).toBe(Math.round(dx));
      expect(Math.round((now?.y ?? 0) - card.y)).toBe(Math.round((moved?.y ?? 0) - section.y));
    }
  });

  it("renames a card: its thumbnail follows", async () => {
    await sidebarItem("Théoden").click({ button: "right" });
    await $('//*[@role="menuitem"][starts-with(normalize-space(),"Renommer")]').click();
    await browser.keys(["Control", "a"]);
    await browser.keys("Théoden Ednew");
    await browser.keys("Enter");
    await sidebarItem(CANVAS).click();
    await surface().waitForDisplayed();
    await browser.waitUntil(
      async () =>
        (await browser.execute(() =>
          [...document.querySelectorAll(".bz-canvas-card")].some((card) =>
            card.textContent?.includes("Théoden Ednew"),
          ),
        )) === true,
      { timeoutMsg: "the thumbnail did not follow the new name" },
    );
  });

  it("puts a pasted image in the media library", async () => {
    const before = (await browser.execute(() =>
      (window as unknown as { __TAURI_INTERNALS__: Invoke }).__TAURI_INTERNALS__.invoke(
        "list_assets",
        { filter: {} },
      ),
    )) as { id: string }[];
    // Excalidraw takes a paste when the keyboard is on it: a click in an empty spot.
    await browser
      .action("pointer", { parameters: { pointerType: "mouse" } })
      .move({ origin: await surface(), x: Math.round(width * 0.42), y: Math.round(-height * 0.42) })
      .down()
      .up()
      .perform();
    await browser.execute(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 120;
      canvas.height = 80;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = "#c0392b";
        context.fillRect(0, 0, 120, 80);
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      const data = new DataTransfer();
      data.items.add(new File([blob], "bannière.png", { type: "image/png" }));
      document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true }));
    });
    await browser.waitUntil(
      async () => (await scene()).some((element) => element.type === "image"),
      { timeoutMsg: "the pasted image is not in the scene" },
    );
    const after = (await browser.execute(() =>
      (window as unknown as { __TAURI_INTERNALS__: Invoke }).__TAURI_INTERNALS__.invoke(
        "list_assets",
        { filter: {} },
      ),
    )) as { id: string }[];
    expect(after).toHaveLength(before.length + 1);
    const image = (await scene()).find((element) => element.type === "image");
    expect(after.some((asset) => asset.id === image?.fileId)).toBe(true);
  });

  it("writes a note in place", async () => {
    await tool("Notes").click();
    await browser.waitUntil(
      async () =>
        (await browser.execute(() => document.activeElement?.getAttribute("aria-label"))) ===
        "Titre de la note",
      { timeoutMsg: "the new note did not take the keyboard" },
    );
    await browser.keys("Conseil de guerre");
    await browser.keys("Escape");
    const note = (await scene()).find((element) => element.link?.endsWith("/note"));
    expect(note?.customData?.title).toBe("Conseil de guerre");
  });

  it("is the same after reopening the world", async () => {
    const before = JSON.stringify(await scene());
    await $("button=Mondes").click();
    await $("h1=Mondes").waitForDisplayed();
    await $(`aria/Ouvrir ${WORLD}`).click();
    await currentWorldButton(WORLD).waitForDisplayed();
    await openTab("World");
    await sidebarItem(CANVAS).click();
    await surface().waitForDisplayed({ timeout: 30000 });
    await browser.waitUntil(async () => (await thumbnails().length) === 3, {
      timeoutMsg: "the thumbnails did not come back",
    });
    expect(JSON.stringify(await scene())).toBe(before);
    await $(
      '//*[contains(@class,"bz-canvas-note")][contains(., "Conseil de guerre")]',
    ).waitForExist();
    // The image's bytes are read back from the media library.
    await browser.waitUntil(
      async () =>
        browser.execute(() => {
          const api = (
            window as unknown as { __bzExcalidraw: { getFiles: () => Record<string, unknown> } }
          ).__bzExcalidraw;
          return Object.keys(api.getFiles()).length === 1;
        }),
      { timeoutMsg: "the image was not read back" },
    );
  });
});
