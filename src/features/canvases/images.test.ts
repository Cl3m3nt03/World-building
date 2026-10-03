import { expect, it } from "vitest";
import { MAX_PLACED_SIDE, missingFiles, placedSize } from "./images";

it("places a big image at most MAX_PLACED_SIDE, keeping its shape", () => {
  expect(placedSize(1920, 1080)).toEqual({ width: MAX_PLACED_SIDE, height: 270 });
  expect(placedSize(200, 100)).toEqual({ width: 200, height: 100 });
  expect(placedSize(0, 0)).toEqual({ width: MAX_PLACED_SIDE, height: MAX_PLACED_SIDE });
});

it("lists the images whose bytes are still to read, once each", () => {
  const elements = [
    { type: "image", fileId: "a.png" },
    { type: "image", fileId: "a.png" },
    { type: "image", fileId: "b.png" },
    { type: "image", fileId: "c.png", isDeleted: true },
    { type: "rectangle" },
  ];
  expect(missingFiles(elements, new Set(["b.png"]))).toEqual(["a.png"]);
});
