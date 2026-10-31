// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CardType, CardTypePatch, NewCardType, PropertyDefinition } from "@/lib/bindings";
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
    templateOnCreate: true,
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
      case "count_type_cards":
        return 0;
      case "list_type_properties":
        return ["Âge", "Titre"].map(
          (label): PropertyDefinition => ({
            id: label,
            owner: { on: "type", typeId: "character" },
            label,
            kind: "text",
            targetTypeIds: [],
            relationTypeId: null,
            options: [],
            multiple: false,
            appliesToExisting: false,
            sortOrder: 0,
            createdAt: "2026-09-27T10:00:00Z",
          }),
        );
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
                templateOnCreate: patch.templateOnCreate ?? type.templateOnCreate,
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

test("a switch turns the template on creation off and on again", async () => {
  renderDialog();
  await screen.findByLabelText("Nom du type");
  const onCreate = screen.getByRole("switch", { name: "Appliquer le modèle à la création" });
  expect(onCreate.getAttribute("aria-checked")).toBe("true");

  fireEvent.click(onCreate);
  await waitFor(() => expect(onCreate.getAttribute("aria-checked")).toBe("false"));
  fireEvent.click(onCreate);
  await waitFor(() => expect(onCreate.getAttribute("aria-checked")).toBe("true"));
  expect(callsOf("update_card_type").map((call) => call.payload)).toEqual([
    { id: "character", patch: { templateOnCreate: false } },
    { id: "character", patch: { templateOnCreate: true } },
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
  const confirm = buttons[buttons.length - 1] as HTMLButtonElement;
  // Enabled once the number of cards of the type is known (none here).
  await waitFor(() => expect(confirm.disabled).toBe(false));
  fireEvent.click(confirm);

  await waitFor(() =>
    expect(callsOf("delete_card_type")[0]?.payload).toEqual({ id: "place", moveCardsTo: null }),
  );
  await waitFor(() => expect(screen.queryByRole("button", { name: "Lieu" })).toBeNull());
});

test("a type with cards asks where they go before deleting", async () => {
  mockIPC((command, payload) => {
    calls.push({ command, payload });
    if (command === "list_card_types") return types;
    if (command === "count_type_cards") return 3;
    return null;
  });
  renderDialog();
  fireEvent.click(await screen.findByRole("button", { name: "Lieu" }));
  await waitFor(() =>
    expect((screen.getByLabelText("Nom du type") as HTMLInputElement).value).toBe("Lieu"),
  );

  fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
  expect(await screen.findByText("Ce type a 3 fiches. Où les déplacer ?")).toBeTruthy();
  const buttons = screen.getAllByRole("button", { name: "Supprimer" });
  // No destination chosen yet: nothing can be deleted.
  expect((buttons[buttons.length - 1] as HTMLButtonElement).disabled).toBe(true);
});

test("the search ignores accents and case", async () => {
  types = [...types, cardType("event", "Événement")];
  renderDialog();
  await screen.findByRole("button", { name: "Personnage" });

  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "evene" } });

  expect(screen.getByRole("button", { name: "Événement" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Personnage" })).toBeNull();
});

test("the arrows move between the types of the list", async () => {
  renderDialog();
  const first = await screen.findByRole("button", { name: "Personnage" });
  first.focus();

  fireEvent.keyDown(first, { key: "ArrowDown" });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Lieu" }));
  fireEvent.keyDown(document.activeElement as Element, { key: "ArrowUp" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "End" });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Lieu" }));
});

test("a subtype leads back to its type; its type lists it as a chip", async () => {
  renderDialog();
  fireEvent.click(await screen.findByRole("button", { name: "Lieu" }));
  // The subtypes of the selected type, as chips, and their count in the list.
  fireEvent.click(await screen.findByRole("button", { name: "Ville" }));
  await waitFor(() =>
    expect((screen.getByLabelText("Nom du type") as HTMLInputElement).value).toBe("Ville"),
  );

  fireEvent.click(screen.getByRole("button", { name: "Sous-type de Lieu" }));
  await waitFor(() =>
    expect((screen.getByLabelText("Nom du type") as HTMLInputElement).value).toBe("Lieu"),
  );
});

test("the sections of the sheet are labelled", async () => {
  renderDialog();
  await screen.findByLabelText("Nom du type");

  for (const name of [
    "Sous-types",
    "Propriétés par défaut",
    "Modèle guidé",
    "Réglages de fiche par défaut",
  ]) {
    expect(screen.getByRole("region", { name })).toBeTruthy();
  }
  expect(screen.getByText("2 types")).toBeTruthy();
});

test("Escape cancels moving a property and leaves the screen open, then closes it", async () => {
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <TooltipProvider>
        <CardTypesDialog open onOpenChange={onOpenChange} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  const handle = await screen.findByRole("button", {
    name: "Déplacer la propriété Titre (Espace, puis flèches)",
  });
  await act(async () => {
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => expect(handle.dataset.moving).toBe("true"));

  await act(async () => {
    fireEvent.keyDown(handle, { code: "Escape", key: "Escape" });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => expect(handle.dataset.moving).toBeUndefined());
  expect(onOpenChange).not.toHaveBeenCalled();

  fireEvent.keyDown(handle, { code: "Escape", key: "Escape" });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
