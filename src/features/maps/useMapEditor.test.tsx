// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import { documentKeys } from "@/features/cards/hooks/keys";
import type { Map as WorldMap } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { useMapEditor } from "./hooks/useMapEditor";

afterEach(() => {
  cleanup();
  clearMocks();
});

const MAP: WorldMap = {
  id: "m1",
  title: "Arda",
  backgroundAssetId: null,
  width: 2000,
  height: 1500,
  tiled: false,
  content: {
    layers: [{ id: "l1", name: "Calque 1", visible: true }],
    pins: [],
    zones: [],
    texts: [],
  },
};

test("a saved map refreshes the cards' « Cité dans »: a pin may now cite one", async () => {
  mockIPC(() => null);
  const queryClient = createQueryClient();
  const backlinks = [...documentKeys.all(), "backlinks", "gondor"];
  queryClient.setQueryData(backlinks, []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useMapEditor(MAP), { wrapper });

  act(() =>
    result.current.update((content) => ({
      ...content,
      pins: [
        {
          id: "p1",
          layerId: "l1",
          cardId: "gondor",
          x: 0.5,
          y: 0.5,
          icon: "castle",
          color: "red",
          label: "",
          size: 1,
        },
      ],
    })),
  );

  await waitFor(() => expect(queryClient.getQueryState(backlinks)?.isInvalidated).toBe(true), {
    timeout: 2000,
  });
});
