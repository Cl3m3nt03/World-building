// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CardType, CardTypePatch, NewCardType } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { CardTypesDialog } from "./CardTypesDialog";

function cardType(id: string, name: string, extra: Partial<CardType> = {}): CardType {
  return {
    id,
    parentId: null,
    name,
    icon: "user",
    color: "blue",
    guidedTemplate: [],
    orientation: "portrait",
    canvasFormat: "standard",
    sortOrder: 0,
    ...extra,
  };
}

type Call = { command: string; payload: unknown };
let calls: Call[];
let types: CardType[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  calls = [];
  types = [
    cardType("character", "Personnage"),
    cardType("place", "Lieu", { icon: "map-pin", color: "green" }),
    cardType("city", "Ville", { parentId: "place", icon: "map-pin", color: "green" }),
    cardType("dungeon", "Donjon", { parentId: "place", icon: "map-pin", color: "green" }),
  ];
  mockIPC((command, payload) => {
    calls.push({ command, payload });
    switch (command) {
      case "list_card_types":
        return types;
      case "create_card_type": {
        const { cardType: next } = payload as { cardType: NewCardType };
        const created = cardType(`new-${types.length}`, next.name, next);
        types = [...types, created];
        return created;
      }
      case "update_card_type": {
        const { id, patch } = payload as { id: string; patch: CardTypePatch };
        types = types.map((type) =>
          type.id === id
            ? {
                ...type,
                name: patch.name ?? type.name,
                color: patch.color ?? type.color,
                orientation: patch.orientation ?? type.orientation,
              }
            : type,
        );
        return types.find((type) => type.id === id);
      }
      case "duplicate_card_type": {
        const { id, name } = payload as { id: string; name: string };
        const source = types.find((type) => type.id === id) as CardType;
        const copy = { ...source, id: "copy", name };
        types = [...types, copy];
        return copy;
      }
      case "delete_card_type": {
        const { id } = payload as { id: string };
        types = types.filter((type) => type.id !== id && type.parentId !== id);
        return null;
      }
      default:
        return null;
    }
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

function renderDialog() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <TooltipProvider>
        <CardTypesDialog open onOpenChange={() => {}} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

const callsOf = (command: string) => calls.filter((call) => call.command === command);

test("lists the types and unfolds the subtypes", async () => {
  renderDialog();

  expect(await screen.findByRole("button", { name: "Personnage" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Ville" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Sous-types de Lieu" }));
  expect(screen.getByRole("button", { name: "Ville" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Donjon" })).toBeTruthy();
});

test("search finds subtypes and shows their type", async () => {
  renderDialog();
  await screen.findByRole("button", { name: "Personnage" });

  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "donj" } });

  expect(screen.queryByRole("button", { name: "Personnage" })).toBeNull();
  expect(screen.getByRole("button", { name: "Lieu" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Donjon" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Ville" })).toBeNull();
});

test("the first type is selected; renaming saves without a button", async () => {
  renderDialog();
  const name = await screen.findByLabelText("Nom du type");
  expect((name as HTMLInputElement).value).toBe("Personnage");

  fireEvent.change(name, { target: { value: "Héros" } });
  fireEvent.blur(name);

  await waitFor(() =>
    expect(callsOf("update_card_type")[0]?.payload).toEqual({
      id: "character",
      patch: { name: "Héros" },
    }),
  );
  expect(await screen.findByRole("button", { name: "Héros" })).toBeTruthy();
});

test("color and orientation are radio choices", async () => {
  renderDialog();
  await screen.findByLabelText("Nom du type");

  fireEvent.click(screen.getByRole("radio", { name: "Violet" }));
  fireEvent.click(screen.getByRole("radio", { name: "Paysage" }));

  await waitFor(() => expect(callsOf("update_card_type")).toHaveLength(2));
  expect(callsOf("update_card_type").map((call) => call.payload)).toEqual([
    { id: "character", patch: { color: "violet" } },
    { id: "character", patch: { orientation: "landscape" } },
  ]);
});

test("creates a type and a subtype", async () => {
  renderDialog();
  await screen.findByLabelText("Nom du type");

  fireEvent.click(screen.getByRole("button", { name: "Nouveau type" }));
  await waitFor(() =>
    expect((screen.getByLabelText("Nom du type") as HTMLInputElement).value).toBe("Nouveau type"),
  );

  fireEvent.change(screen.getByLabelText("Nom du sous-type"), { target: { value: "Relique" } });
  fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

  await waitFor(() => expect(callsOf("create_card_type")).toHaveLength(2));
  expect(callsOf("create_card_type")[1]?.payload).toEqual({
    cardType: { parentId: "new-4", name: "Relique", icon: "shapes", color: "slate" },
  });
  expect(await screen.findByRole("button", { name: "Relique" })).toBeTruthy();
});

test("duplicates a type under a translated name", async () => {
  renderDialog();
  await screen.findByLabelText("Nom du type");

  fireEvent.click(screen.getByRole("button", { name: "Dupliquer" }));

  await waitFor(() =>
    expect(callsOf("duplicate_card_type")[0]?.payload).toEqual({
      id: "character",
      name: "Personnage (copie)",
    }),
  );
});

test("deleting a type asks first and mentions its subtypes", async () => {
  renderDialog();
  fireEvent.click(await screen.findByRole("button", { name: "Lieu" }));
  await waitFor(() =>
    expect((screen.getByLabelText("Nom du type") as HTMLInputElement).value).toBe("Lieu"),
  );

  fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
  expect(
    await screen.findByText("Le type et ses 2 sous-types sont supprimés de ce monde."),
  ).toBeTruthy();
  const buttons = screen.getAllByRole("button", { name: "Supprimer" });
  fireEvent.click(buttons[buttons.length - 1] as HTMLElement);

  await waitFor(() =>
    expect(callsOf("delete_card_type")[0]?.payload).toEqual({ id: "place", moveCardsTo: null }),
  );
  await waitFor(() => expect(screen.queryByRole("button", { name: "Lieu" })).toBeNull());
});
