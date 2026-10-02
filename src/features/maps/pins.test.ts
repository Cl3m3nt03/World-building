import { expect, test } from "vitest";
import type { MapContent } from "@/lib/bindings";
import { addPin, KEYBOARD_STEP, newPin, nudgePin, removePin, updatePin } from "./pins";

const EMPTY: MapContent = {
  layers: [{ id: "l1", name: "Calque 1", visible: true }],
  pins: [],
  zones: [],
  texts: [],
};

test("pins are added, changed, nudged and removed, always on the image", () => {
  const marker = newPin("l1", 0.2, 1.4, null, "Repère");
  expect(marker).toMatchObject({
    layerId: "l1",
    cardId: null,
    x: 0.2,
    y: 1,
    label: "Repère",
    size: 1,
  });
  const tied = newPin("l1", 0.5, 0.5, "gondor");
  expect(tied.cardId).toBe("gondor");

  let content = addPin(addPin(EMPTY, marker), tied);
  expect(content.pins).toHaveLength(2);
  content = updatePin(content, marker.id, { label: "Phare", x: -3, size: 2 });
  expect(content.pins[0]).toMatchObject({ label: "Phare", x: 0, size: 2 });
  content = nudgePin(content, tied.id, 2, -1);
  expect(content.pins[1]?.x).toBeCloseTo(0.5 + 2 * KEYBOARD_STEP);
  expect(content.pins[1]?.y).toBeCloseTo(0.5 - KEYBOARD_STEP);
  expect(nudgePin(content, "nowhere", 1, 1)).toBe(content);
  expect(removePin(content, marker.id).pins.map((pin) => pin.id)).toEqual([tied.id]);
});
