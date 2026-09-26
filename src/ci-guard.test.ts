import { expect, test } from "vitest";

// Throwaway: proves CI blocks a PR with a failing test. Never merge.
test("fails on purpose", () => {
  expect(1).toBe(2);
});
