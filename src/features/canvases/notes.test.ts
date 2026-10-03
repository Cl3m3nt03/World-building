import { describe, expect, it } from "vitest";
import { isNoteLink, NEW_NOTE, NOTE_LINK, noteBackground, noteOf, paperOf } from "./notes";

describe("noteOf", () => {
  it("reads a note", () => {
    const note = { title: "Plan", text: "Tenir", color: "pink", pattern: "grid" };
    expect(noteOf(note)).toEqual(note);
  });

  it("opens a damaged note with defaults", () => {
    expect(noteOf(undefined)).toEqual(NEW_NOTE);
    expect(noteOf({ title: 3, color: "chartreuse", pattern: "waves" })).toEqual(NEW_NOTE);
  });

  it("cuts what is too long", () => {
    expect(noteOf({ title: "x".repeat(500) }).title).toHaveLength(200);
  });
});

it("knows its link", () => {
  expect(isNoteLink(NOTE_LINK)).toBe(true);
  expect(isNoteLink("https://builderz.invalid/card/a")).toBe(false);
  expect(isNoteLink(null)).toBe(false);
});

describe("noteBackground", () => {
  it("rules the paper as asked", () => {
    const { paper, rule } = paperOf("blue");
    expect(noteBackground({ color: "blue", pattern: "plain" })).toEqual({ backgroundColor: paper });
    expect(noteBackground({ color: "blue", pattern: "lined" }).backgroundImage).toContain(rule);
    expect(noteBackground({ color: "blue", pattern: "grid" }).backgroundImage).toMatch(/to right/);
    expect(noteBackground({ color: "blue", pattern: "dotted" }).backgroundImage).toMatch(/radial/);
  });
});
