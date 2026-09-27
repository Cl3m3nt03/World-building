// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { CardType, TemplateSection } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { TemplateEditor } from "./TemplateEditor";

function cardType(
  id: string,
  template: TemplateSection[],
  parentId: string | null = null,
): CardType {
  return {
    id,
    parentId,
    name: id === "place" ? "Lieu" : id,
    icon: "user",
    color: "blue",
    guidedTemplate: template,
    orientation: "portrait",
    canvasFormat: "standard",
    sortOrder: 0,
  };
}

let patches: { id: string; patch: { guidedTemplate?: TemplateSection[] } }[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  patches = [];
  mockIPC((command, payload) => {
    if (command === "update_card_type") {
      patches.push(payload as (typeof patches)[number]);
    }
    return null;
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

function renderEditor(type: CardType, parent?: CardType) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <TemplateEditor type={type} parent={parent} />
    </QueryClientProvider>,
  );
}

const lastTemplate = () => patches.at(-1)?.patch.guidedTemplate;

test("adds a section with a title and a help question", async () => {
  renderEditor(cardType("character", []));

  fireEvent.click(screen.getByRole("button", { name: "Ajouter une section" }));
  const title = screen.getByRole("textbox", { name: "Titre de la section 1" });
  fireEvent.change(title, { target: { value: "Background" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Question d'aide de la section 1" }), {
    target: { value: "D'où vient-il ?" },
  });
  fireEvent.blur(title);

  await waitFor(() =>
    expect(lastTemplate()).toEqual([{ title: "Background", prompt: "D'où vient-il ?" }]),
  );
});

test("moves and deletes sections; untitled ones are not kept", async () => {
  renderEditor(
    cardType("character", [
      { title: "A", prompt: "" },
      { title: "B", prompt: "" },
    ]),
  );

  fireEvent.click(screen.getByRole("button", { name: "Monter la section 2" }));
  await waitFor(() => expect(lastTemplate()?.map((s) => s.title)).toEqual(["B", "A"]));

  fireEvent.click(screen.getByRole("button", { name: "Supprimer la section 1" }));
  await waitFor(() => expect(lastTemplate()?.map((s) => s.title)).toEqual(["A"]));

  fireEvent.click(screen.getByRole("button", { name: "Ajouter une section" }));
  fireEvent.blur(screen.getByRole("textbox", { name: "Titre de la section 2" }));
  await waitFor(() => expect(lastTemplate()?.map((s) => s.title)).toEqual(["A"]));
});

test("a subtype without its own template says it uses its type's", () => {
  const place = cardType("place", [{ title: "Géographie", prompt: "" }]);
  renderEditor(cardType("city", [], "place"), place);

  expect(
    screen.getByText(
      "Sans template propre, les cartes de ce sous-type utilisent celui de « Lieu ».",
    ),
  ).toBeTruthy();
});
