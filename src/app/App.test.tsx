// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ErrorBoundary } from "@/app/ErrorScreen";
import { createAppRouter } from "@/app/router";
import { tabFromPath } from "@/app/shell/WorldLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createQueryClient } from "@/lib/query";

afterEach(cleanup);

async function renderAt(path: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  await act(async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await router.load();
  });
  return router;
}

describe("routing", () => {
  test("/ shows the world list", async () => {
    await renderAt("/");
    expect(screen.getByRole("heading", { name: "Mondes" })).toBeTruthy();
  });

  test("/world/$worldId redirects to the Home tab", async () => {
    const router = await renderAt("/world/demo");
    expect(router.state.location.pathname).toBe("/world/demo/home");
    expect(screen.getByRole("heading", { name: "Bienvenue" })).toBeTruthy();
  });

  test("clicking a tab navigates to its route", async () => {
    const router = await renderAt("/world/demo/home");
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Wiki" }), { button: 0 });
    });
    expect(router.state.location.pathname).toBe("/world/demo/wiki");
    expect(screen.getByRole("tab", { name: "Wiki" }).getAttribute("data-state")).toBe("active");
  });

  test("the Worlds button goes back to the world list", async () => {
    const router = await renderAt("/world/demo/world");
    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "Mondes" }));
    });
    expect(router.state.location.pathname).toBe("/");
  });

  test("an unknown route shows the not-found screen", async () => {
    await renderAt("/nowhere");
    expect(screen.getByRole("heading", { name: "Page introuvable" })).toBeTruthy();
  });

  test("tabFromPath reads the tab segment", () => {
    expect(tabFromPath("/world/demo/quill")).toBe("quill");
    expect(tabFromPath("/world/demo")).toBeUndefined();
    expect(tabFromPath("/world/demo/nope")).toBeUndefined();
  });
});

describe("error boundary", () => {
  test("a render error shows the error screen instead of a blank page", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    function Broken(): never {
      throw new Error("boom");
    }

    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Une erreur est survenue" })).toBeTruthy();
    expect(screen.getByText(/boom/)).toBeTruthy();
    consoleError.mockRestore();
  });
});
