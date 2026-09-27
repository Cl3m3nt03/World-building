// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { JSONContent } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CardType, TemplateSection } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { BlockEditor, type BlockEditorHandle } from "./BlockEditor";
import { type Block, parseContent, type TextBlock } from "./model";
import { effectiveTemplate, templateBlocks } from "./template";

const CHARACTER: TemplateSection[] = [
  { title: "Background", prompt: "D'où vient-il ?" },
  { title: "Personnalité", prompt: "Qu'est-ce qui le fait agir ?" },
  { title: "Apparence", prompt: "" },
];

function cardType(
  id: string,
  template: TemplateSection[],
  parentId: string | null = null,
): CardType {
  return {
    id,
    parentId,
    name: id,
    icon: "user",
    color: "blue",
    guidedTemplate: template,
    orientation: "portrait",
    canvasFormat: "standard",
    sortOrder: 0,
  };
}

function textBlock(id: string, content: JSONContent[]): TextBlock {
  return { id, type: "text", doc: { type: "doc", content } };
}

const titles = (blocks: Block[]) =>
  blocks.map((block) =>
    block.type === "text" ? (block.doc.content?.[0]?.content?.[0]?.text ?? "") : block.type,
  );

test("a subtype without a template uses its type's", () => {
  const place = cardType("place", CHARACTER);
  const city = cardType("city", [], "place");
  const own = cardType("own", [{ title: "Maire", prompt: "" }], "place");
  expect(effectiveTemplate(city, [place, city])).toBe(CHARACTER);
  expect(effectiveTemplate(own, [place, own])).toEqual([{ title: "Maire", prompt: "" }]);
  expect(effectiveTemplate(undefined, [])).toEqual([]);
});

test("template blocks are titled, carry the help question, and skip existing headings", () => {
  const existing = [
    textBlock("a", [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: " personnalité " }] },
      { type: "paragraph", content: [{ type: "text", text: "Colérique." }] },
    ]),
  ];

  const added = templateBlocks(existing, CHARACTER);

  expect(titles(added)).toEqual(["Background", "Apparence"]);
  expect(added[0]?.prompt).toBe("D'où vient-il ?");
  // No help question: no prompt.
  expect(added[1]?.prompt).toBeUndefined();
  expect(templateBlocks([], [{ title: "  ", prompt: "x" }])).toEqual([]);
});

let initial: Block[];
let saved: string[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  initial = [];
  saved = [];
  mockIPC((command, payload) => {
    if (command === "get_card_content") return JSON.stringify(initial);
    if (command === "set_card_content") {
      saved.push((payload as { content: string }).content);
    }
    return null;
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

function renderEditor(ref?: React.Ref<BlockEditorHandle>) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <TooltipProvider>
        <BlockEditor
          cardId="aragorn"
          template={CHARACTER}
          templateName="Personnage"
          {...(ref ? { ref } : {})}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

test("an empty card offers its type's template", async () => {
  renderEditor();

  const use = await screen.findByRole("button", { name: /Utiliser le template « Personnage »/ });
  expect(use.textContent).toContain("Background · Personnalité · Apparence");
  fireEvent.click(use);

  await waitFor(() => expect(saved).toHaveLength(1));
  expect(titles(parseContent(saved[0] as string))).toEqual([
    "Background",
    "Personnalité",
    "Apparence",
  ]);
  expect(
    await screen.findByText("3 sections du template ajoutées à la fin de la carte."),
  ).toBeTruthy();
});

test("applying keeps the existing content, and twice adds nothing more", async () => {
  initial = [
    textBlock("mine", [{ type: "paragraph", content: [{ type: "text", text: "Déjà écrit." }] }]),
  ];
  const ref = createRef<BlockEditorHandle>();
  renderEditor(ref);
  await screen.findByRole("textbox", { name: "Bloc de texte 1" });

  act(() => ref.current?.applyTemplate());
  await waitFor(() => expect(saved).toHaveLength(1));
  const after = parseContent(saved[0] as string);
  expect(after[0]).toEqual(initial[0]);
  expect(titles(after).slice(1)).toEqual(["Background", "Personnalité", "Apparence"]);

  act(() => ref.current?.applyTemplate());
  expect(
    await screen.findByText("Toutes les sections du template sont déjà dans la carte."),
  ).toBeTruthy();
  expect(saved).toHaveLength(1);
});
