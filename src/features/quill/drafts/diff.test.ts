import { describe, expect, test } from "vitest";
import { compareDrafts, diffWords, draftParagraphs, paragraphs } from "./diff";

describe("paragraphs", () => {
  test("titles, paragraphs, quotes, list items and dividers, mentions by name", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Prologue" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Ami de " },
            { type: "mention", attrs: { id: "a", label: "Apex" } },
          ],
        },
        { type: "paragraph" },
        { type: "horizontalRule" },
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Cité" }] }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Un" }] }],
            },
          ],
        },
      ],
    };
    expect(paragraphs(doc)).toEqual(["Prologue", "Ami de Apex", "———", "Cité", "Un"]);
  });
});

describe("diffWords", () => {
  test("keeps the common words and marks the others", () => {
    const { left, right } = diffWords(
      "Il pleuvait sur la vallée.",
      "Il neigeait sur la vallée ce soir.",
    );
    expect(left).toEqual([
      { text: "Il ", kind: "same" },
      { text: "pleuvait ", kind: "removed" },
      { text: "sur la ", kind: "same" },
      { text: "vallée.", kind: "removed" },
    ]);
    expect(right).toEqual([
      { text: "Il ", kind: "same" },
      { text: "neigeait ", kind: "added" },
      { text: "sur la ", kind: "same" },
      { text: "vallée ce soir.", kind: "added" },
    ]);
  });
});

describe("compareDrafts", () => {
  test("equal paragraphs face each other, changed ones are paired, the rest on one side", () => {
    const rows = compareDrafts(
      ["Prologue", "Il pleuvait.", "Fin."],
      ["Prologue", "Il neigeait.", "Un ajout.", "Fin."],
    );
    expect(
      rows.map((row) => [
        row.left?.map((p) => p.kind).join(),
        row.right?.map((p) => p.kind).join(),
      ]),
    ).toEqual([
      ["same", "same"],
      ["same,removed", "same,added"],
      [undefined, "added"],
      ["same", "same"],
    ]);
  });

  test("identical drafts have no change", () => {
    const rows = compareDrafts(["A", "B"], ["A", "B"]);
    expect(rows.every((row) => row.left?.[0]?.kind === "same")).toBe(true);
  });

  test("each side keeps its paragraph's alignment; an alignment alone is not a change of text", () => {
    const draft = (align: string | null) => ({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: align },
          content: [{ type: "text", text: "Fin." }],
        },
      ],
    });
    expect(draftParagraphs(draft("center"))).toEqual([{ text: "Fin.", align: "center" }]);
    expect(draftParagraphs(draft(null))).toEqual([{ text: "Fin.", align: null }]);
    const [row] = compareDrafts(draftParagraphs(draft(null)), draftParagraphs(draft("right")));
    expect(row?.left?.[0]?.kind).toBe("same");
    expect([row?.leftAlign, row?.rightAlign]).toEqual([null, "right"]);
  });
});
