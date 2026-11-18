// @vitest-environment jsdom
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/lib/query";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** The app's router, built from a fresh router module under the current env. */
async function routePaths() {
  vi.resetModules();
  const { createAppRouter } = await import("./router");
  const router = createAppRouter(
    createQueryClient(),
    createMemoryHistory({ initialEntries: ["/"] }),
  );
  return Object.keys(router.routesByPath);
}

test("has the design system page in a development build", async () => {
  expect(await routePaths()).toContain("/design-system");
});

test("leaves the design system page out of a published build (#615)", async () => {
  vi.stubEnv("DEV", false);
  const paths = await routePaths();
  expect(paths).not.toContain("/design-system");
  expect(paths).toContain("/");
});
