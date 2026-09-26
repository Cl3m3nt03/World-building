import { expect, test } from "vitest";
import en from "./en.json";
import fr from "./fr.json";

test("fr.json and en.json have exactly the same keys", () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
});
