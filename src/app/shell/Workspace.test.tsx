// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { WorldWorkspace } from "./Workspace";

/** What the sidebar's panel was given, render after render. */
const panel = vi.hoisted(() => ({
  sizes: [] as (number | undefined)[],
  onResize: undefined as ((size: { inPixels: number }) => void) | undefined,
}));
const sidebar = vi.hoisted(() => ({
  state: { width: 300, collapsed: false } as { width: number; collapsed: boolean },
  update: vi.fn(),
}));
const route = vi.hoisted(() => ({ worldId: "world-1" }));

vi.mock("@/components/ui/resizable", () => ({
  ResizableHandle: () => null,
  ResizablePanelGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({
    children,
    defaultSize,
    onResize,
  }: {
    children: ReactNode;
    defaultSize?: number;
    onResize?: (size: { inPixels: number }) => void;
  }) => {
    if (onResize) {
      panel.sizes.push(defaultSize);
      panel.onResize = onResize;
    }
    return <div>{children}</div>;
  },
}));
vi.mock("@tanstack/react-router", () => ({
  Outlet: () => null,
  useParams: () => route,
}));
vi.mock("@/features/sidebar", () => ({
  useSidebarState: () => ({ state: sidebar.state, error: null, update: sidebar.update }),
  WorldSidebar: () => null,
}));
vi.mock("@/features/canvases", () => ({ useCreateCanvas: vi.fn() }));
vi.mock("@/features/cards", () => ({ CreateCardMenu: vi.fn() }));
vi.mock("@/features/graphs", () => ({ useCreateGraph: vi.fn() }));
vi.mock("@/features/maps", () => ({ CreateMapDialog: vi.fn() }));
vi.mock("@/features/timelines", () => ({ useCreateTimeline: vi.fn() }));
vi.mock("@/features/trees", () => ({ useCreateTree: vi.fn() }));
vi.mock("./navigation", () => ({ usePageFade: vi.fn() }));

afterEach(cleanup);

beforeEach(() => {
  panel.sizes = [];
  sidebar.state = { width: 300, collapsed: false };
  sidebar.update.mockReset();
  route.worldId = "world-1";
});

test("a width saved during a drag does not change the panel's default size", () => {
  const { rerender } = render(<WorldWorkspace />);
  act(() => panel.onResize?.({ inPixels: 340 }));
  expect(sidebar.update).toHaveBeenCalledWith({ collapsed: false, width: 340 });
  sidebar.state = { width: 340, collapsed: false };
  rerender(<WorldWorkspace />);
  expect(new Set(panel.sizes)).toEqual(new Set([300]));
});

test("another world opens at its own width", () => {
  const { rerender } = render(<WorldWorkspace />);
  route.worldId = "world-2";
  sidebar.state = { width: 420, collapsed: false };
  rerender(<WorldWorkspace />);
  expect(panel.sizes.at(-1)).toBe(420);
});

test("a collapsed sidebar opens at 0", () => {
  sidebar.state = { width: 300, collapsed: true };
  render(<WorldWorkspace />);
  expect(panel.sizes.at(-1)).toBe(0);
});
