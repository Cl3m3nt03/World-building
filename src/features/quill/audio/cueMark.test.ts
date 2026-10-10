import { expect, test } from "vitest";
import { cueSpans } from "./cueMark";

const cue = (id: string, kind = "effect") => ({ type: "audioCue", attrs: { cueId: id, kind } });

test("a text's sounds, in its order, with their passage and the blocks they cover", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Avant." }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "La pluie ", marks: [cue("rain", "ambience")] },
          { type: "text", text: "tonne", marks: [cue("rain", "ambience"), cue("bang")] },
        ],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "et dure.", marks: [cue("rain", "ambience")] }],
      },
    ],
  };
  expect(cueSpans(doc)).toEqual([
    { cueId: "rain", text: "La pluie tonne et dure.", first: 1, last: 2 },
    { cueId: "bang", text: "tonne", first: 1, last: 1 },
  ]);
  expect(cueSpans({ type: "doc" })).toEqual([]);
});
