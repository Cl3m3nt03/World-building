// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Timeline } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { parseContent, type TimelineBlock } from "./model";
import { TimelineBlockView } from "./TimelineBlockView";

const HISTORY: Timeline = {
  id: "tl1",
  title: "Histoire de Westeros",
  tracks: [{ id: "kings", name: "Rois", color: "amber" }],
  items: [
    {
      id: "crowned",
      trackId: "kings",
      cardId: "robert",
      title: "",
      color: "amber",
      description: "",
      start: 283 * 360,
      end: 298 * 360,
      precision: "year",
    },
  ],
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  // jsdom lays nothing out: the timeline's drawing is 800 pixels wide.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        if (target.getAttribute("role") !== "application") return;
        this.callback(
          [{ target, contentRect: { width: 800, height: 280 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
  mockIPC((command) => {
    if (command === "list_documents") {
      return [
        {
          id: "tl1",
          kind: "timeline",
          title: "Histoire de Westeros",
          createdAt: "",
          updatedAt: "",
          openedAt: null,
          trashedAt: null,
        },
      ];
    }
    if (command === "get_timeline") return HISTORY;
    if (command === "list_cards") {
      return [{ id: "robert", title: "Robert Baratheon", aliases: [], typeId: null }];
    }
    return null;
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The block in Robert's card. */
async function renderBlock(block: TimelineBlock, onChange: (block: TimelineBlock) => void) {
  const root = createRootRoute({ component: Outlet });
  const world = createRoute({
    getParentRoute: () => root,
    path: "/world/$worldId",
    component: Outlet,
  });
  const card = createRoute({
    getParentRoute: () => world,
    path: "world/card/$cardId",
    component: () => <TimelineBlockView block={block} label="Bloc frise 1" onChange={onChange} />,
  });
  const router = createRouter({
    routeTree: root.addChildren([world.addChildren([card])]),
    history: createMemoryHistory({ initialEntries: ["/world/demo/world/card/robert"] }),
  });
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
}

test("a timeline block chooses a timeline of the world", async () => {
  const onChange = vi.fn();
  await renderBlock({ id: "b", type: "timeline", timelineId: null }, onChange);
  fireEvent.click(await screen.findByRole("combobox", { name: "Frise à afficher" }));
  fireEvent.click(await screen.findByRole("option", { name: "Histoire de Westeros" }));
  expect(onChange).toHaveBeenCalledWith({ id: "b", type: "timeline", timelineId: "tl1" });
});

test("a chosen timeline shows read-only, and opens on this card's item", async () => {
  await renderBlock({ id: "b", type: "timeline", timelineId: "tl1" }, () => {});
  const view = await screen.findByRole("application", { name: "Frise Histoire de Westeros" });
  expect(within(view).getByRole("button", { name: "Robert Baratheon, de 283 à 298" })).toBeTruthy();
  const link = await screen.findByRole("link", { name: "Ouvrir la frise" });
  await waitFor(() =>
    expect(link.getAttribute("href")).toBe("/world/demo/world/timeline/tl1?card=robert"),
  );
  expect(parseContent(JSON.stringify([{ id: "b", type: "timeline", timelineId: "" }]))).toEqual([
    { id: "b", type: "timeline", timelineId: null },
  ]);
});
