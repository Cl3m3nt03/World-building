// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createQueryClient } from "@/lib/query";
import { BlockEditor } from "../BlockEditor";
import { emptyStats5eBlock, parseContent, type Stats5eBlock } from "../model";
import { formatBonus, modifier, readWholeNumber, skillBonus } from "./rules";
import { Stats5eBlockView } from "./Stats5eBlockView";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockIPC((command) => (command === "get_card_content" ? "[]" : null));
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

test("5e modifiers and bonuses", () => {
  expect([1, 8, 9, 10, 11, 15, 20, 30].map(modifier)).toEqual([-5, -1, -1, 0, 0, 2, 5, 10]);
  expect(formatBonus(2)).toBe("+2");
  expect(formatBonus(0)).toBe("+0");
  expect(formatBonus(-1)).toBe("−1");
  expect(skillBonus(15, true, 2)).toBe(4);
  expect(skillBonus(8, false, 3)).toBe(-1);
  expect(readWholeNumber(" 42 ", 1, 30)).toBe(30);
  expect(readWholeNumber("0", 1, 30)).toBe(1);
  expect(readWholeNumber("12.5", 1, 30)).toBeNull();
  expect(readWholeNumber("douze", 1, 30)).toBeNull();
});

test("a saved sheet is read with defaults for what is missing or wrong", () => {
  const [block] = parseContent(
    JSON.stringify([
      {
        id: "s",
        type: "stats5e",
        abilities: { str: 15, dex: 99, con: "12" },
        armorClass: 16,
        skills: ["athletics", "flying"],
        actions: [{ name: "Épée longue" }],
      },
    ]),
  ) as Stats5eBlock[];

  expect(block?.abilities).toEqual({ str: 15, dex: 30, con: 10, int: 10, wis: 10, cha: 10 });
  expect(block?.armorClass).toBe(16);
  expect(block?.hitPoints).toBeNull();
  expect(block?.proficiencyBonus).toBe(2);
  expect(block?.skills).toEqual(["athletics"]);
  expect(block?.actions[0]).toMatchObject({ name: "Épée longue", description: "" });
});

/** The block with its own state, as in the editor. */
function Harness({ onChange }: { onChange: (block: Stats5eBlock) => void }) {
  const [block, setBlock] = useState(emptyStats5eBlock());
  return (
    <Stats5eBlockView
      block={block}
      label="Fiche de stats 5e 1"
      onChange={(next) => {
        setBlock(next);
        onChange(next);
      }}
    />
  );
}

test("a Strength of 15 shows +2, and changing it updates the modifier", () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  const strength = screen.getByRole("textbox", { name: "Force" });
  const modifierOutput = () => screen.getByLabelText("Modificateur de Force").textContent;

  expect(modifierOutput()).toBe("+0");
  fireEvent.change(strength, { target: { value: "15" } });
  expect(modifierOutput()).toBe("+2");
  fireEvent.change(strength, { target: { value: "8" } });
  expect(modifierOutput()).toBe("−1");
  expect(onChange.mock.lastCall?.[0].abilities.str).toBe(8);
});

test("a skill adds the proficiency bonus when proficient", () => {
  render(<Harness onChange={() => {}} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Force" }), { target: { value: "15" } });
  const athletics = screen.getByRole("checkbox", { name: "Maîtrise de Athlétisme" });
  const bonus = () => athletics.closest("label")?.textContent;

  expect(bonus()).toContain("+2");
  fireEvent.click(athletics);
  expect(bonus()).toContain("+4");
});

test("a value that is not a number is said and not passed on", () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);

  fireEvent.change(screen.getByRole("textbox", { name: "Classe d'armure" }), {
    target: { value: "seize" },
  });

  expect(screen.getByText("Un nombre entier entre 0 et 99.")).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
});

test("actions are added, named and deleted", () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);

  fireEvent.click(screen.getByRole("button", { name: "Ajouter une action" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Nom de l'action 1" }), {
    target: { value: "Épée longue" },
  });
  expect(onChange.mock.lastCall?.[0].actions).toEqual([
    expect.objectContaining({ name: "Épée longue", description: "" }),
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Supprimer l'action 1" }));
  expect(onChange.mock.lastCall?.[0].actions).toEqual([]);
});

test("skills are listed alphabetically in the app language", () => {
  render(<Harness onChange={() => {}} />);
  const names = screen
    .getAllByRole("checkbox")
    .map((box) => box.getAttribute("aria-label")?.replace("Maîtrise de ", ""));
  expect(names.slice(0, 4)).toEqual(["Acrobaties", "Arcanes", "Athlétisme", "Discrétion"]);
});

test("the block menu offers the 5e sheet and the map (available since M4)", async () => {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <TooltipProvider>
        <BlockEditor cardId="aragorn" />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  const add = await screen.findByRole("button", { name: "Ajouter un bloc" });
  await act(async () => {
    add.focus();
    fireEvent.keyDown(add, { key: "Enter" });
  });

  expect(await screen.findByRole("menuitem", { name: "Fiche de stats 5e" })).toBeTruthy();
  const map = screen.getByRole("menuitem", { name: "Map" });
  expect(map.getAttribute("aria-disabled")).toBeNull();
});
