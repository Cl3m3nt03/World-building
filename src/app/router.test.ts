// @vitest-environment jsdom
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/lib/query";

/** Importing the whole app's routes afresh is slow under a full test run. */
const IMPORT_TIMEOUT_MS = 30_000;

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

test(
  "has the design system page in a development build",
  async () => {
    expect(await routePaths()).toContain("/design-system");
  },
  IMPORT_TIMEOUT_MS,
);

test(
  "leaves the design system page out of a published build (#615)",
  async () => {
    vi.stubEnv("MODE", "production");
    const paths = await routePaths();
    expect(paths).not.toContain("/design-system");
    expect(paths).toContain("/");
  },
  IMPORT_TIMEOUT_MS,
);
