// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { readMode } from "../components/ModeBar";
import { BookText, blockTexts } from "./BookText";
import { DEFAULT_READER, PAGE_THEMES, pageColors, readerFont } from "./settings";

const doc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Avant" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Le roi " },
        { type: "mention", attrs: { id: "c1", label: "Aragorn" } },
        {
          type: "text",
          text: " revint",
          marks: [{ type: "bold" }, { type: "note", attrs: { noteId: "n1" } }],
        },
      ],
    },
    { type: "horizontalRule" },
    {
      type: "blockquote",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Fin" }] }],
    },
  ],
};

test("a chapter's text reads as a book: blocks numbered, mentions by name, notes unseen", () => {
  const { container } = render(<BookText doc={doc} />);
  expect(container.querySelector("h2")?.textContent).toBe("Avant");
  expect(container.querySelector("p")?.textContent).toBe("Le roi Aragorn revint");
  expect(container.querySelector("strong")?.textContent).toBe(" revint");
  expect([...container.querySelectorAll("[data-block]")].map((el) => el.tagName)).toEqual([
    "H2",
    "P",
    "HR",
    "BLOCKQUOTE",
  ]);
  expect(blockTexts(doc)).toEqual(["Avant", "Le roi  Aragorn  revint", "", "Fin"]);
});

test("a page's colours: its theme's, or its background with a text that reads on it", () => {
  expect(pageColors(DEFAULT_READER)).toEqual(PAGE_THEMES.light);
  expect(pageColors({ ...DEFAULT_READER, background: "#1b2230" }).text).toBe(PAGE_THEMES.dark.text);
  expect(pageColors({ ...DEFAULT_READER, theme: "dark", background: "#ffffff" }).text).toBe(
    PAGE_THEMES.light.text,
  );
  expect(readerFont("lora")).toContain("Lora");
  expect(readerFont("unknown")).toContain("Garamond");
});

test("the mode of the writing space is read from the address", () => {
  expect(readMode("publish")).toBe("publish");
  expect(readMode("nope")).toBe("write");
  expect(readMode(undefined)).toBe("write");
});
