// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { WorldWorkspace } from "./Workspace";

const seen = vi.hoisted(() => ({ behavior: undefined as string | undefined }));

vi.mock("@/components/ui/resizable", () => ({
  ResizableHandle: () => null,
  ResizablePanelGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({
    children,
    onResize,
    groupResizeBehavior,
  }: {
    children: ReactNode;
    onResize?: unknown;
    groupResizeBehavior?: string;
  }) => {
    if (onResize) seen.behavior = groupResizeBehavior;
    return <div>{children}</div>;
  },
}));
vi.mock("@tanstack/react-router", () => ({ Outlet: () => null, useParams: () => ({}) }));
vi.mock("@/features/sidebar", () => ({
  useSidebarState: () => ({
    state: { width: 280, collapsed: false },
    error: null,
    update: vi.fn(),
  }),
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

test("the sidebar keeps its width in pixels when the window changes", () => {
  render(<WorldWorkspace />);
  expect(seen.behavior).toBe("preserve-pixel-size");
});
