// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Asset } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { BlockEditor } from "./BlockEditor";
import { ImageBlockView } from "./ImageBlockView";
import { type ImageBlock, parseContent } from "./model";

function asset(letter: string, name: string): Asset {
  return {
    id: `${letter.repeat(64)}.png`,
    name,
    kind: "image",
    mime: "image/png",
    size: 1024,
    width: 64,
    height: 64,
    createdAt: "2026-09-27T10:00:00Z",
  };
}

const IMAGE = asset("a", "Terrasen.png");
const FOREST = asset("b", "Forêt.png");
const CASTLE = asset("c", "Château.png");

let assets: Asset[];
let saved: string[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  assets = [IMAGE, FOREST, CASTLE];
  saved = [];
  mockIPC((command, payload) => {
    const args = payload as Record<string, unknown>;
    if (command === "list_assets") return assets;
    if (command === "get_card_content") return "[]";
    if (command === "set_card_content") {
      saved.push(args.content as string);
      return null;
    }
    return null;
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

function wrap(node: React.ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <TooltipProvider>{node}</TooltipProvider>
    </QueryClientProvider>
  );
}

function block(...images: [Asset, string][]): ImageBlock {
  return {
    id: "img",
    type: "image",
    images: images.map(([image, caption], index) => ({
      id: `i${index + 1}`,
      assetId: image.id,
      caption,
    })),
  };
}

/** Renders a block that saves its changes into itself, like the card does. */
function Controlled({ initial, changes }: { initial: ImageBlock; changes: ImageBlock[] }) {
  const [value, setValue] = useState(initial);
  return (
    <ImageBlockView
      block={value}
      label="Bloc image 1"
      onChange={(next) => {
        changes.push(next);
        setValue(next);
      }}
      pickOnMount={false}
    />
  );
}

test("an empty image block offers to choose an image", async () => {
  render(
    wrap(
      <ImageBlockView
        block={block()}
        label="Bloc image 1"
        onChange={() => {}}
        pickOnMount={false}
      />,
    ),
  );

  expect(screen.getByText("Aucune image dans ce bloc.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Choisir une image" }));
  expect(await screen.findByRole("dialog", { name: "Choisir une image" })).toBeTruthy();
});

test("the image shows with its caption, which saves as typed", async () => {
  const onChange = vi.fn();
  render(
    wrap(
      <ImageBlockView
        block={block([IMAGE, "Carte"])}
        label="Bloc image 1"
        onChange={onChange}
        pickOnMount={false}
      />,
    ),
  );

  const image = await screen.findByRole("img", { name: "Carte" });
  expect(image.getAttribute("src")).toBe(`http://bzasset.localhost/${IMAGE.id}`);
  fireEvent.change(screen.getByLabelText("Légende"), { target: { value: "Carte de Terrasen" } });
  expect(onChange).toHaveBeenCalledWith(block([IMAGE, "Carte de Terrasen"]));
  // A single image shows no thumbnails.
  expect(screen.queryByRole("list", { name: "Images du bloc" })).toBeNull();
});

test("an image deleted from the media library is said to be gone", async () => {
  assets = [];
  render(
    wrap(
      <ImageBlockView
        block={block([IMAGE, ""])}
        label="Bloc image 1"
        onChange={() => {}}
        pickOnMount={false}
      />,
    ),
  );

  expect(await screen.findByText("Cette image n'est plus dans la médiathèque.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Changer" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retirer" })).toBeTruthy();
});

test('"Add a block" › Image inserts an image block and opens the picker', async () => {
  render(wrap(<BlockEditor cardId="aragorn" />));
  const add = await screen.findByRole("button", { name: "Ajouter un bloc" });

  await act(async () => {
    add.focus();
    fireEvent.keyDown(add, { key: "Enter" });
  });
  await act(async () => {
    fireEvent.click(await screen.findByRole("menuitem", { name: "Image" }));
  });

  expect(await screen.findByRole("dialog", { name: "Choisir une image" })).toBeTruthy();
  await waitFor(() => expect(saved.length).toBeGreaterThan(0));
  expect(parseContent(saved.at(-1) as string)).toEqual([
    expect.objectContaining({ type: "image", images: [] }),
  ]);
});

test("a block saved before galleries reads as a gallery of its image", () => {
  const saved = JSON.stringify([
    { id: "old", type: "image", assetId: IMAGE.id, caption: "Carte" },
    { id: "empty", type: "image", assetId: null, caption: "" },
  ]);
  expect(parseContent(saved)).toEqual([
    {
      id: "old",
      type: "image",
      images: [{ id: expect.any(String), assetId: IMAGE.id, caption: "Carte" }],
    },
    { id: "empty", type: "image", images: [] },
  ]);
});

test("three images go by with the arrows, the thumbnails and the keyboard", async () => {
  const changes: ImageBlock[] = [];
  render(
    wrap(
      <Controlled
        initial={block([IMAGE, "Terrasen"], [FOREST, "La forêt"], [CASTLE, "Le château"])}
        changes={changes}
      />,
    ),
  );

  expect(await screen.findByRole("img", { name: "Terrasen" })).toBeTruthy();
  expect(screen.getByText("1 / 3")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Image précédente" }) as HTMLButtonElement).disabled,
  ).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Image suivante" }));
  expect(screen.getByRole("img", { name: "La forêt" })).toBeTruthy();
  expect(screen.getByText("Image 2 sur 3 : La forêt")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Image 3 sur 3 : Le château" }));
  expect(screen.getByRole("img", { name: "Le château" })).toBeTruthy();

  // One stop of Tab: the shown thumbnail; ← → Home End go through.
  const shown = screen.getByRole("button", { name: "Image 3 sur 3 : Le château" });
  expect(shown.getAttribute("tabindex")).toBe("0");
  expect(shown.getAttribute("aria-current")).toBe("true");
  fireEvent.keyDown(shown, { key: "Home" });
  expect(screen.getByRole("img", { name: "Terrasen" })).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("button", { name: "Image 1 sur 3 : Terrasen" }), {
    key: "ArrowRight",
  });
  expect(screen.getByRole("img", { name: "La forêt" })).toBeTruthy();
  expect(changes).toEqual([]);
});

test("each image keeps its own caption", async () => {
  const changes: ImageBlock[] = [];
  render(wrap(<Controlled initial={block([IMAGE, "Terrasen"], [FOREST, ""])} changes={changes} />));

  fireEvent.click(await screen.findByRole("button", { name: "Image 2 sur 2" }));
  fireEvent.change(screen.getByLabelText("Légende de l'image 2"), {
    target: { value: "La forêt" },
  });

  expect(changes.at(-1)?.images.map((image) => image.caption)).toEqual(["Terrasen", "La forêt"]);
});

test("Delete on a thumbnail removes its image from the block", async () => {
  const changes: ImageBlock[] = [];
  render(
    wrap(
      <Controlled
        initial={block([IMAGE, "Terrasen"], [FOREST, "La forêt"], [CASTLE, "Le château"])}
        changes={changes}
      />,
    ),
  );

  fireEvent.keyDown(await screen.findByRole("button", { name: "Image 1 sur 3 : Terrasen" }), {
    key: "ArrowRight",
  });
  fireEvent.keyDown(screen.getByRole("button", { name: "Image 2 sur 3 : La forêt" }), {
    key: "Delete",
  });

  expect(changes.at(-1)?.images.map((image) => image.assetId)).toEqual([IMAGE.id, CASTLE.id]);
  // The next image shows in its place; the asset stays in the media library.
  expect(screen.getByRole("img", { name: "Le château" })).toBeTruthy();
  expect(screen.getByText("Image retirée, 2 images dans le bloc.")).toBeTruthy();
});

test('"Add images" ticks several images of the media library, in order', async () => {
  const changes: ImageBlock[] = [];
  render(wrap(<Controlled initial={block([IMAGE, "Terrasen"])} changes={changes} />));

  fireEvent.click(await screen.findByRole("button", { name: "Ajouter des images" }));
  const dialog = await screen.findByRole("dialog", { name: "Choisir une image" });
  expect(dialog.querySelector("[aria-multiselectable=true]")).toBeTruthy();
  fireEvent.click(await screen.findByRole("option", { name: "Château.png" }));
  fireEvent.click(screen.getByRole("option", { name: "Forêt.png" }));
  fireEvent.click(screen.getByRole("button", { name: "Ajouter 2 images" }));

  await waitFor(() => expect(changes.length).toBe(1));
  expect(changes[0]?.images.map((image) => image.assetId)).toEqual([
    IMAGE.id,
    CASTLE.id,
    FOREST.id,
  ]);
  // The first added image shows.
  expect(screen.getByText("2 / 3")).toBeTruthy();
});
