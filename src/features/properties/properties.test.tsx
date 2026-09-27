// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CardProperty, PropertyDefinition, PropertyValue } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { CardProperties } from "./components/CardProperties";
import { TypeProperties } from "./components/TypeProperties";

function definition(
  id: string,
  label: string,
  extra: Partial<PropertyDefinition> = {},
): PropertyDefinition {
  return {
    id,
    owner: { on: "type", typeId: "character" },
    label,
    kind: "text",
    targetTypeIds: [],
    appliesToExisting: false,
    sortOrder: 0,
    createdAt: "2026-09-27T10:00:00Z",
    ...extra,
  };
}

type Call = { command: string; payload: unknown };
let calls: Call[];
let typeProps: PropertyDefinition[];
let cardProps: CardProperty[];
let valueCount: number;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  calls = [];
  typeProps = [definition("title", "Titre")];
  cardProps = [
    { definition: definition("age", "Âge", { kind: "number" }), value: null },
    { definition: definition("title", "Titre"), value: { kind: "text", value: "Roi" } },
  ];
  valueCount = 3;
  mockIPC((command, payload) => {
    calls.push({ command, payload });
    const args = payload as Record<string, unknown>;
    switch (command) {
      case "list_type_properties":
        return typeProps;
      case "card_properties":
        return cardProps;
      case "create_property": {
        const owner = args.owner as PropertyDefinition["owner"];
        const created = definition(`new-${calls.length}`, args.label as string, { owner });
        if (owner.on === "type") typeProps = [...typeProps, created];
        else cardProps = [...cardProps, { definition: created, value: null }];
        return created;
      }
      case "rename_property": {
        typeProps = typeProps.map((p) =>
          p.id === args.id ? { ...p, label: args.label as string } : p,
        );
        return typeProps.find((p) => p.id === args.id);
      }
      case "apply_property_to_existing":
        return typeProps.find((p) => p.id === args.id);
      case "count_property_values":
        return valueCount;
      case "delete_property":
        typeProps = typeProps.filter((p) => p.id !== args.id);
        return null;
      case "set_property_value": {
        cardProps = cardProps.map((p) =>
          p.definition.id === args.propertyId
            ? { ...p, value: args.value as PropertyValue | null }
            : p,
        );
        return cardProps;
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

function renderWith(node: React.ReactNode) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <TooltipProvider>{node}</TooltipProvider>
    </QueryClientProvider>,
  );
}

const callsOf = (command: string) => calls.filter((call) => call.command === command);

test("adding a type property asks whether to apply it to the existing cards", async () => {
  renderWith(<TypeProperties typeId="character" />);
  await screen.findByRole("button", { name: "Modifier la propriété Titre" });

  fireEvent.click(screen.getByRole("button", { name: "Ajouter une propriété" }));

  // The new property opens in its editor, to be named.
  const name = await screen.findByLabelText("Nom");
  expect((name as HTMLInputElement).value).toBe("Nouvelle propriété");
  fireEvent.change(name, { target: { value: "Âge" } });
  fireEvent.blur(name);
  await waitFor(() =>
    expect(callsOf("rename_property")[0]?.payload).toMatchObject({ label: "Âge" }),
  );

  expect(
    screen.getByText("Appliquer les changements à toutes les cartes de ce type ?"),
  ).toBeTruthy();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Oui" }));
  });
  await waitFor(() => expect(callsOf("apply_property_to_existing")).toHaveLength(1));
  expect(
    screen.queryByText("Appliquer les changements à toutes les cartes de ce type ?"),
  ).toBeNull();
});

test("skipping leaves the existing cards as they are", async () => {
  renderWith(<TypeProperties typeId="character" />);
  await screen.findByRole("button", { name: "Modifier la propriété Titre" });

  fireEvent.click(screen.getByRole("button", { name: "Ajouter une propriété" }));
  fireEvent.click(await screen.findByRole("button", { name: "Ignorer" }));

  expect(screen.queryByRole("button", { name: "Oui" })).toBeNull();
  expect(callsOf("apply_property_to_existing")).toHaveLength(0);
});

test("deleting a property says how many values would be lost", async () => {
  renderWith(<TypeProperties typeId="character" />);
  fireEvent.click(await screen.findByRole("button", { name: "Modifier la propriété Titre" }));

  fireEvent.click(await screen.findByRole("button", { name: "Supprimer" }));
  expect(await screen.findByText("Supprimer « Titre » ? 3 valeurs seront perdues.")).toBeTruthy();
  const confirm = screen.getAllByRole("button", { name: "Supprimer" }).at(-1) as HTMLButtonElement;
  await waitFor(() => expect(confirm.disabled).toBe(false));
  fireEvent.click(confirm);

  await waitFor(() => expect(callsOf("delete_property")[0]?.payload).toEqual({ id: "title" }));
});

test("a card shows its properties and saves numbers and texts", async () => {
  renderWith(<CardProperties cardId="aragorn" />);

  const age = await screen.findByRole("textbox", { name: "Âge" });
  const title = screen.getByRole("textbox", { name: "Titre" });
  expect((title as HTMLInputElement).value).toBe("Roi");

  fireEvent.change(age, { target: { value: "8,7" } });
  fireEvent.blur(age);
  await waitFor(() =>
    expect(callsOf("set_property_value")[0]?.payload).toEqual({
      cardId: "aragorn",
      propertyId: "age",
      value: { kind: "number", value: 8.7 },
    }),
  );

  // Not a number: said, and not saved.
  fireEvent.change(age, { target: { value: "vieux" } });
  fireEvent.blur(age);
  expect(
    await screen.findByText("Ce n'est pas un nombre : la valeur n'est pas enregistrée."),
  ).toBeTruthy();
  expect(callsOf("set_property_value")).toHaveLength(1);

  // Emptied: the value is cleared.
  fireEvent.change(title, { target: { value: "" } });
  fireEvent.blur(title);
  await waitFor(() =>
    expect(callsOf("set_property_value")[1]?.payload).toEqual({
      cardId: "aragorn",
      propertyId: "title",
      value: null,
    }),
  );
});

test("a property can be added to one card only", async () => {
  renderWith(<CardProperties cardId="aragorn" />);
  await screen.findByRole("textbox", { name: "Âge" });

  fireEvent.click(screen.getByRole("button", { name: "Propriété propre à cette carte" }));

  await waitFor(() =>
    expect(callsOf("create_property")[0]?.payload).toEqual({
      owner: { on: "card", cardId: "aragorn" },
      label: "Nouvelle propriété",
      kind: "text",
    }),
  );
  expect(
    await screen.findByRole("button", { name: "Modifier la propriété Nouvelle propriété" }),
  ).toBeTruthy();
});
