// @vitest-environment jsdom
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { CardType } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import type { Block } from "./model";
import { useSaveCardContent, useStartFromTemplate } from "./useCardContent";

/**
 * #598: the sidebar and the wiki search the cards' text; their results are
 * cached by query and must not outlive a change of that text.
 */

const SEARCH = ["documents", "search", "marimba"];

let client: QueryClient;

beforeEach(() => {
  mockIPC(() => null);
  client = createQueryClient();
  // A search made before the text changed: nothing found.
  client.setQueryData(SEARCH, []);
});

afterEach(() => {
  cleanup();
  clearMocks();
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const block: Block = {
  id: "t1",
  type: "text",
  doc: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Marimba" }] }],
  },
};

test("saving a card's text makes the searches made before it stale", async () => {
  const save = renderHook(() => useSaveCardContent("alvar"), { wrapper });
  expect(client.getQueryState(SEARCH)?.isInvalidated).toBe(false);

  await act(() => save.result.current.save([block]));

  await waitFor(() => expect(client.getQueryState(SEARCH)?.isInvalidated).toBe(true));
});

test("a new card's template makes the searches made before it stale", async () => {
  const start = renderHook(() => useStartFromTemplate(), { wrapper });
  const type = {
    id: "person",
    templateOnCreate: true,
    guidedTemplate: [{ title: "Marimba", prompt: "" }],
    parentId: null,
  } as unknown as CardType;

  await act(() => start.result.current("alvar", type, [type]));

  expect(client.getQueryState(SEARCH)?.isInvalidated).toBe(true);
});
