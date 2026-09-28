// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Card } from "@/lib/bindings";
import { TextBlockEditor } from "../TextBlockEditor";
import { DEFAULT_PREFERENCES, MentionContext, type MentionWorld } from "./MentionContext";
import { MAX_SUGGESTIONS, searchMentions } from "./search";
import { createSuggestionStore } from "./suggestionStore";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function card(id: string, title: string, aliases: string[] = []): Card {
  return {
    id,
    title,
    typeId: null,
    imageAssetId: null,
    aliases,
    createdAt: "2026-09-27T10:00:00Z",
    updatedAt: "2026-09-27T10:00:00Z",
    trashedAt: null,
  };
}

const CARDS = [
  card("aragorn", "Aragorn", ["Grands-Pas", "Élessar"]),
  card("arwen", "Arwen"),
  card("gandalf", "Gandalf", ["Mithrandir"]),
  card("rohan", "Rohan"),
];

test("search matches names first, then aliases, ignoring case and accents", () => {
  const titles = (query: string) =>
    searchMentions(CARDS, query, "none").map(
      (s) => `${s.card.title}${s.alias ? `/${s.alias}` : ""}`,
    );

  expect(titles("ar")).toEqual(["Aragorn", "Arwen"]);
  expect(titles("MITH")).toEqual(["Gandalf/Mithrandir"]);
  expect(titles("elessar")).toEqual(["Aragorn/Élessar"]);
  // A name match wins over an alias match of the same card.
  expect(titles("a")).toEqual(["Aragorn", "Arwen", "Gandalf", "Rohan"]);
  expect(titles("zzz")).toEqual([]);
});

test("search leaves out the card being edited and caps the results", () => {
  expect(searchMentions(CARDS, "", "arwen").map((s) => s.card.id)).not.toContain("arwen");
  const many = Array.from({ length: 20 }, (_, i) => card(`c${i}`, `Carte ${i}`));
  expect(searchMentions(many, "carte", "none")).toHaveLength(MAX_SUGGESTIONS);
});

test("the suggestion store moves, wraps around, picks and closes", () => {
  const store = createSuggestionStore();
  const picked = vi.fn();
  const items = searchMentions(CARDS, "ar", "none");

  store.show(items, null, picked);
  expect(store.get()).toMatchObject({ open: true, active: 0 });
  store.move(1);
  expect(store.get().active).toBe(1);
  store.move(1);
  expect(store.get().active).toBe(0);
  store.move(-1);
  expect(store.get().active).toBe(1);

  expect(store.pick()).toBe(true);
  expect(picked).toHaveBeenCalledWith(items[1]);

  store.close();
  expect(store.get().open).toBe(false);
  expect(store.pick()).toBe(false);
});

function renderMention(world: Partial<MentionWorld>, id: string, label: string) {
  const value: MentionWorld = {
    cards: [],
    trashed: [],
    types: [],
    preferences: DEFAULT_PREFERENCES,
    open: vi.fn(),
    ...world,
  };
  render(
    <MentionContext.Provider value={value}>
      <TextBlockEditor
        cardId="frodo"
        label="Bloc de texte 1"
        doc={{
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Avec " },
                { type: "mention", attrs: { id, label } },
              ],
            },
          ],
        }}
        onChange={() => {}}
        onSlash={() => {}}
      />
    </MentionContext.Provider>,
  );
  return value;
}

test("a mention shows the card's current name and opens it on click", async () => {
  const world = renderMention(
    { cards: [card("gandalf", "Gandalf le Blanc")] },
    "gandalf",
    "Gandalf",
  );

  const link = await screen.findByRole("link", { name: "Ouvrir la carte Gandalf le Blanc" });
  expect(link.textContent).toBe("Gandalf le Blanc");
  fireEvent.click(link);
  expect(world.open).toHaveBeenCalledWith("gandalf");
});

test("a mention of a card in the trash is a dead reference with its latest name", async () => {
  renderMention({ trashed: [card("gandalf", "Gandalf le Gris")] }, "gandalf", "Gandalf");

  const dead = await screen.findByLabelText("Gandalf le Gris (carte à la corbeille ou supprimée)");
  expect(dead.classList.contains("mention-dead")).toBe(true);
  expect(screen.queryByRole("link")).toBeNull();
});

test("a mention of a card deleted for good shows the name it had", async () => {
  renderMention({}, "gone", "Saroumane");

  expect(
    await screen.findByLabelText("Saroumane (carte à la corbeille ou supprimée)"),
  ).toBeTruthy();
});
