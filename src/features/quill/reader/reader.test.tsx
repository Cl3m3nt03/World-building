// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { readMode } from "../components/ModeBar";
import { BookText, blockTexts } from "./BookText";
import { fileName } from "./ExportPanel";
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

test("a block keeps its alignment in the book; one without keeps the page's own", () => {
  const aligned = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2, textAlign: "center" },
        content: [{ type: "text", text: "Titre" }],
      },
      {
        type: "paragraph",
        attrs: { textAlign: "right" },
        content: [{ type: "text", text: "Signé" }],
      },
      { type: "paragraph", attrs: { textAlign: null }, content: [{ type: "text", text: "Rien" }] },
      {
        type: "paragraph",
        attrs: { textAlign: "sideways" },
        content: [{ type: "text", text: "Inconnu" }],
      },
    ],
  };
  const { container } = render(<BookText doc={aligned} />);
  const [title] = container.querySelectorAll("h3");
  const [right, none, unknown] = container.querySelectorAll("p");
  expect(title?.style.textAlign).toBe("center");
  expect(right?.style.textAlign).toBe("right");
  expect(none?.hasAttribute("style")).toBe(false);
  expect(unknown?.hasAttribute("style")).toBe(false);
  // The old text, without the attribute, is drawn as before.
  const old = render(<BookText doc={doc} />).container;
  expect(old.querySelector("[style*='text-align']")).toBeNull();
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

test("an exported file is named after the story, without what Windows refuses", () => {
  expect(fileName("La Chute : le Roi?")).toBe("La Chute  le Roi");
  expect(fileName("  <>  ")).toBe("story");
});
