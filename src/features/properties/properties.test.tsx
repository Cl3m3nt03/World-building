// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CardProperties } from "@/features/cards/components/CardProperties";
import type { CardProperty, PropertyDefinition, PropertyValue } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
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
    relationTypeId: null,
    options: [],
    multiple: false,
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
let optionUses: number;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  calls = [];
  typeProps = [definition("title", "Titre")];
  cardProps = [
    { definition: definition("age", "Âge", { kind: "number" }), value: null },
    { definition: definition("title", "Titre"), value: { kind: "text", value: "Roi" } },
  ];
  valueCount = 3;
  optionUses = 0;
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
        const kind = args.kind as PropertyDefinition["kind"];
        const created = definition(`new-${calls.length}`, args.label as string, { owner, kind });
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
      case "set_property_options": {
        const options = (args.options as { id: string | null; label: string }[]).map(
          (option, index) => ({ id: option.id ?? `option-${index}`, label: option.label }),
        );
        const multiple = args.multiple as boolean;
        const change = (p: PropertyDefinition) =>
          p.id === args.id ? { ...p, options, multiple } : p;
        typeProps = typeProps.map(change);
        cardProps = cardProps.map((p) => ({ ...p, definition: change(p.definition) }));
        return typeProps.find((p) => p.id === args.id);
      }
      case "count_property_option_values":
        return optionUses;
      case "current_world":
        return {
          calendar: {
            eras: [],
            months: [
              { name: "Givre", days: 30 },
              { name: "", days: 30 },
            ],
          },
        };
      case "count_property_values":
        return valueCount;
      case "list_relation_types":
        return [
          {
            id: "rel-parent",
            builtin: "parent",
            name: "",
            icon: "arrow-up",
            inverseId: "rel-child",
            category: "family",
            sortOrder: 0,
          },
        ];
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
  renderWith(<TypeProperties typeId="character" types={[]} />);
  await screen.findByRole("button", { name: "Modifier la propriété Titre" });

  // The same small window as on a card: its name, then its kind.
  fireEvent.click(screen.getByRole("button", { name: "Ajouter une propriété" }));
  fireEvent.change(await screen.findByLabelText("Nom de la propriété"), {
    target: { value: "Âge" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Nombre" }));
  await waitFor(() =>
    expect(callsOf("create_property")[0]?.payload).toEqual({
      owner: { on: "type", typeId: "character" },
      label: "Âge",
      kind: "number",
    }),
  );

  expect(
    await screen.findByText("Appliquer les changements à toutes les cartes de ce type ?"),
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
  renderWith(<TypeProperties typeId="character" types={[]} />);
  await screen.findByRole("button", { name: "Modifier la propriété Titre" });

  fireEvent.click(screen.getByRole("button", { name: "Ajouter une propriété" }));
  fireEvent.click(await screen.findByRole("button", { name: "Texte" }));
  fireEvent.click(await screen.findByRole("button", { name: "Ignorer" }));

  expect(screen.queryByRole("button", { name: "Oui" })).toBeNull();
  expect(callsOf("apply_property_to_existing")).toHaveLength(0);
});

test("a type's link property says which types it accepts", async () => {
  typeProps = [definition("home", "Foyer", { kind: "card", targetTypeIds: ["place"] })];
  const place = {
    id: "place",
    parentId: null,
    name: "Lieu",
    icon: "map-pin",
    color: "green",
    guidedTemplate: [],
    orientation: "portrait" as const,
    canvasFormat: "standard" as const,
    templateOnCreate: true,
    sortOrder: 0,
  };
  renderWith(<TypeProperties typeId="character" types={[place]} />);

  const row = await screen.findByRole("button", { name: "Modifier la propriété Foyer" });
  expect(row.textContent).toContain("Lien vers une carte");
  expect(row.textContent).toContain("Lieu");
});

test("deleting a property says how many values would be lost", async () => {
  renderWith(<TypeProperties typeId="character" types={[]} />);
  fireEvent.click(await screen.findByRole("button", { name: "Modifier la propriété Titre" }));

  fireEvent.click(await screen.findByRole("button", { name: "Supprimer" }));
  expect(await screen.findByText("Supprimer « Titre » ? 3 valeurs seront perdues.")).toBeTruthy();
  const confirm = screen.getAllByRole("button", { name: "Supprimer" }).at(-1) as HTMLButtonElement;
  await waitFor(() => expect(confirm.disabled).toBe(false));
  fireEvent.click(confirm);

  await waitFor(() => expect(callsOf("delete_property")[0]?.payload).toEqual({ id: "title" }));
});

test("a link property says the relation it carries", async () => {
  typeProps = [definition("parents", "Parents", { kind: "cards", relationTypeId: "rel-parent" })];
  renderWith(<TypeProperties typeId="character" types={[]} />);
  fireEvent.click(await screen.findByRole("button", { name: "Modifier la propriété Parents" }));

  expect(await screen.findByLabelText("Relation")).toBeTruthy();
  expect(
    await screen.findByText(
      "Chaque carte choisie dans « Parents » est parent de cette carte : les arbres et le Graph le savent.",
    ),
  ).toBeTruthy();
});

test("a text property has no relation to choose", async () => {
  renderWith(<TypeProperties typeId="character" types={[]} />);
  fireEvent.click(await screen.findByRole("button", { name: "Modifier la propriété Titre" }));
  await screen.findByRole("button", { name: "Supprimer" });
  expect(screen.queryByLabelText("Relation")).toBeNull();
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

test("a named link to several cards is added from its family", async () => {
  renderWith(<CardProperties cardId="aragorn" />);
  await screen.findByRole("textbox", { name: "Âge" });
  fireEvent.click(screen.getByRole("button", { name: "Ajouter une propriété" }));
  fireEvent.change(await screen.findByLabelText("Nom de la propriété"), {
    target: { value: "Alliés" },
  });
  fireEvent.click(screen.getByLabelText("Plusieurs cartes à la fois"));
  fireEvent.click(screen.getByRole("button", { name: "N'importe quelle carte" }));
  await waitFor(() =>
    expect(callsOf("create_property")[0]?.payload).toEqual({
      owner: { on: "card", cardId: "aragorn" },
      label: "Alliés",
      kind: "cards",
    }),
  );
});

test("a property can be added to one card only", async () => {
  renderWith(<CardProperties cardId="aragorn" />);
  await screen.findByRole("textbox", { name: "Âge" });

  fireEvent.click(screen.getByRole("button", { name: "Ajouter une propriété" }));
  fireEvent.click(await screen.findByRole("button", { name: "Texte" }));

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

const OPTIONS = [
  { id: "alive", label: "Vivant" },
  { id: "dead", label: "Mort" },
];

function selectProperty(extra: Partial<PropertyDefinition> = {}) {
  return definition("status", "Statut", { kind: "select", options: OPTIONS, ...extra });
}

/** Opens a Radix menu by its trigger (it listens to the pointer, not the click). */
function openMenu(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
}

test("the kinds select and date are offered in the Value family", async () => {
  renderWith(<CardProperties cardId="aragorn" />);
  await screen.findByRole("textbox", { name: "Âge" });

  fireEvent.click(screen.getByRole("button", { name: "Ajouter une propriété" }));
  fireEvent.click(await screen.findByRole("button", { name: "Sélection" }));
  await waitFor(() =>
    expect(callsOf("create_property")[0]?.payload).toEqual({
      owner: { on: "card", cardId: "aragorn" },
      label: "Nouvelle propriété",
      kind: "select",
    }),
  );

  fireEvent.click(screen.getByRole("button", { name: "Ajouter une propriété" }));
  fireEvent.click(await screen.findByRole("button", { name: "Date" }));
  await waitFor(() =>
    expect(callsOf("create_property")[1]?.payload).toMatchObject({ kind: "date" }),
  );
});

test("a new select opens its window on the types screen, to list its choices", async () => {
  renderWith(<TypeProperties typeId="character" types={[]} />);
  await screen.findByRole("button", { name: "Modifier la propriété Titre" });

  fireEvent.click(screen.getByRole("button", { name: "Ajouter une propriété" }));
  fireEvent.click(await screen.findByRole("button", { name: "Sélection" }));

  expect(await screen.findByRole("group", { name: "Choix" })).toBeTruthy();
});

test("choices are added, renamed and ordered by sending the whole list with their ids", async () => {
  typeProps = [selectProperty()];
  renderWith(<TypeProperties typeId="character" types={[]} />);
  fireEvent.click(await screen.findByRole("button", { name: "Modifier la propriété Statut" }));

  const add = await screen.findByRole("textbox", { name: "Ajouter un choix" });
  fireEvent.change(add, { target: { value: " Disparu " } });
  fireEvent.keyDown(add, { key: "Enter" });
  await waitFor(() =>
    expect(callsOf("set_property_options")[0]?.payload).toEqual({
      id: "status",
      options: [...OPTIONS, { id: null, label: "Disparu" }],
      multiple: false,
    }),
  );

  const name = await screen.findByRole("textbox", { name: "Nom du choix Vivant" });
  fireEvent.change(name, { target: { value: "En vie" } });
  fireEvent.blur(name);
  await waitFor(() => expect(callsOf("set_property_options")).toHaveLength(2));
  expect(callsOf("set_property_options")[1]?.payload).toMatchObject({
    options: [{ id: "alive", label: "En vie" }, { id: "dead" }, { label: "Disparu" }],
  });

  fireEvent.click(await screen.findByRole("button", { name: "Descendre le choix En vie" }));
  await waitFor(() => expect(callsOf("set_property_options")).toHaveLength(3));
  expect(callsOf("set_property_options")[2]?.payload).toMatchObject({
    options: [{ id: "dead" }, { id: "alive" }, { label: "Disparu" }],
  });
});

test("an emptied choice name goes back to the old one and saves nothing", async () => {
  typeProps = [selectProperty()];
  renderWith(<TypeProperties typeId="character" types={[]} />);
  fireEvent.click(await screen.findByRole("button", { name: "Modifier la propriété Statut" }));

  const name = await screen.findByRole<HTMLInputElement>("textbox", {
    name: "Nom du choix Vivant",
  });
  fireEvent.change(name, { target: { value: "  " } });
  fireEvent.blur(name);

  expect(name.value).toBe("Vivant");
  expect(callsOf("set_property_options")).toHaveLength(0);
});

test("removing a choice that cards hold says how many, then asks", async () => {
  typeProps = [selectProperty()];
  optionUses = 2;
  renderWith(<TypeProperties typeId="character" types={[]} />);
  fireEvent.click(await screen.findByRole("button", { name: "Modifier la propriété Statut" }));

  fireEvent.click(await screen.findByRole("button", { name: "Retirer le choix Mort" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Retirer « Mort » ? 2 cartes le perdront.");
  expect(callsOf("set_property_options")).toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: "Retirer" }));
  await waitFor(() =>
    expect(callsOf("set_property_options")[0]?.payload).toMatchObject({
      options: [{ id: "alive", label: "Vivant" }],
    }),
  );
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

test("removing a choice no card holds asks nothing", async () => {
  typeProps = [selectProperty()];
  renderWith(<TypeProperties typeId="character" types={[]} />);
  fireEvent.click(await screen.findByRole("button", { name: "Modifier la propriété Statut" }));

  fireEvent.click(await screen.findByRole("button", { name: "Retirer le choix Mort" }));
  await waitFor(() => expect(callsOf("set_property_options")).toHaveLength(1));
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a select can allow several choices", async () => {
  typeProps = [selectProperty()];
  renderWith(<TypeProperties typeId="character" types={[]} />);
  fireEvent.click(await screen.findByRole("button", { name: "Modifier la propriété Statut" }));

  fireEvent.click(await screen.findByRole("switch", { name: "Plusieurs choix par carte" }));
  await waitFor(() =>
    expect(callsOf("set_property_options")[0]?.payload).toMatchObject({ multiple: true }),
  );
});

test("a card picks one choice, shown as a chip that can be removed", async () => {
  cardProps = [{ definition: selectProperty(), value: null }];
  renderWith(<CardProperties cardId="aragorn" />);

  openMenu(await screen.findByRole("button", { name: "Choisir pour Statut" }));
  fireEvent.click(await screen.findByRole("menuitemradio", { name: "Mort" }));
  await waitFor(() =>
    expect(callsOf("set_property_value")[0]?.payload).toEqual({
      cardId: "aragorn",
      propertyId: "status",
      value: { kind: "select", value: ["dead"] },
    }),
  );

  expect((await screen.findByRole("list", { name: "Statut" })).textContent).toContain("Mort");
  fireEvent.click(screen.getByRole("button", { name: "Retirer Mort" }));
  await waitFor(() =>
    expect(callsOf("set_property_value")[1]?.payload).toMatchObject({ value: null }),
  );
});

test("a card ticks several choices when the property allows it", async () => {
  cardProps = [
    {
      definition: selectProperty({ multiple: true }),
      value: { kind: "select", value: ["alive"] },
    },
  ];
  renderWith(<CardProperties cardId="aragorn" />);

  openMenu(await screen.findByRole("button", { name: "Choisir pour Statut" }));
  fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Mort" }));
  await waitFor(() =>
    expect(callsOf("set_property_value")[0]?.payload).toMatchObject({
      value: { kind: "select", value: ["alive", "dead"] },
    }),
  );
});

test("a select without choices says so in its menu", async () => {
  cardProps = [{ definition: selectProperty({ options: [] }), value: null }];
  renderWith(<CardProperties cardId="aragorn" />);

  openMenu(await screen.findByRole("button", { name: "Choisir pour Statut" }));
  expect(await screen.findByText("Aucun choix pour l'instant")).toBeTruthy();
});

test("a date is written in the world's calendar", async () => {
  cardProps = [
    {
      definition: definition("birth", "Naissance", { kind: "date" }),
      // 60 days a year: the 3rd day of the first month of the year 2.
      value: { kind: "date", value: { days: 122, precision: "day" } },
    },
  ];
  renderWith(<CardProperties cardId="aragorn" />);

  expect(await screen.findByText("3 Givre 2")).toBeTruthy();
});

test("an untouched date field saves nothing; OK keeps the date it shows", async () => {
  cardProps = [{ definition: definition("birth", "Naissance", { kind: "date" }), value: null }];
  renderWith(<CardProperties cardId="aragorn" />);

  const field = await screen.findByRole("button", { name: "Naissance : aucune date" });
  fireEvent.click(field);
  await screen.findByRole("group", { name: "Naissance" });
  fireEvent.keyDown(document.activeElement ?? field, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("group", { name: "Naissance" })).toBeNull());
  expect(callsOf("set_property_value")).toHaveLength(0);

  fireEvent.click(field);
  fireEvent.click(await screen.findByRole("button", { name: "OK" }));
  await waitFor(() =>
    expect(callsOf("set_property_value")[0]?.payload).toMatchObject({
      value: { kind: "date", value: { days: 0, precision: "year" } },
    }),
  );
});

test("a date changed in its window is saved once when the window closes", async () => {
  cardProps = [
    {
      definition: definition("birth", "Naissance", { kind: "date" }),
      value: { kind: "date", value: { days: 120, precision: "year" } },
    },
  ];
  renderWith(<CardProperties cardId="aragorn" />);

  fireEvent.click(await screen.findByRole("button", { name: "Naissance : 2" }));
  const year = await screen.findByRole("spinbutton", { name: "Année" });
  fireEvent.change(year, { target: { value: "3" } });
  fireEvent.change(year, { target: { value: "31" } });
  expect(callsOf("set_property_value")).toHaveLength(0);

  fireEvent.keyDown(year, { key: "Enter" });
  await waitFor(() => expect(callsOf("set_property_value")).toHaveLength(1));
  expect(callsOf("set_property_value")[0]?.payload).toMatchObject({
    value: { kind: "date", value: { days: 1860, precision: "year" } },
  });
});

test("a date can be cleared", async () => {
  cardProps = [
    {
      definition: definition("birth", "Naissance", { kind: "date" }),
      value: { kind: "date", value: { days: 120, precision: "year" } },
    },
  ];
  renderWith(<CardProperties cardId="aragorn" />);

  fireEvent.click(await screen.findByRole("button", { name: "Naissance : 2" }));
  fireEvent.click(await screen.findByRole("button", { name: "Effacer la date" }));
  await waitFor(() =>
    expect(callsOf("set_property_value")[0]?.payload).toMatchObject({ value: null }),
  );
});
