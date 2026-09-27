// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Asset } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { BlockEditor } from "./BlockEditor";
import { ImageBlockView } from "./ImageBlockView";
import { type ImageBlock, parseContent } from "./model";

const IMAGE: Asset = {
  id: `${"a".repeat(64)}.png`,
  name: "Terrasen.png",
  kind: "image",
  mime: "image/png",
  size: 1024,
  width: 64,
  height: 64,
  createdAt: "2026-09-27T10:00:00Z",
};

let assets: Asset[];
let saved: string[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  assets = [IMAGE];
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

function block(extra: Partial<ImageBlock> = {}): ImageBlock {
  return { id: "img", type: "image", assetId: null, caption: "", ...extra };
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
        block={block({ assetId: IMAGE.id, caption: "Carte" })}
        label="Bloc image 1"
        onChange={onChange}
        pickOnMount={false}
      />,
    ),
  );

  const image = await screen.findByRole("img", { name: "Carte" });
  expect(image.getAttribute("src")).toBe(`http://bzasset.localhost/${IMAGE.id}`);
  fireEvent.change(screen.getByLabelText("Légende"), { target: { value: "Carte de Terrasen" } });
  expect(onChange).toHaveBeenCalledWith(block({ assetId: IMAGE.id, caption: "Carte de Terrasen" }));
});

test("an image deleted from the media library is said to be gone", async () => {
  assets = [];
  render(
    wrap(
      <ImageBlockView
        block={block({ assetId: IMAGE.id })}
        label="Bloc image 1"
        onChange={() => {}}
        pickOnMount={false}
      />,
    ),
  );

  expect(await screen.findByText("Cette image n'est plus dans la médiathèque.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Changer" })).toBeTruthy();
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
    expect.objectContaining({ type: "image", assetId: null, caption: "" }),
  ]);
});
