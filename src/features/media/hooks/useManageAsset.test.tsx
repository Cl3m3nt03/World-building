// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { useDeleteAsset } from "./useManageAsset";

beforeEach(() => {
  mockIPC(() => null);
});

afterEach(() => {
  cleanup();
  clearMocks();
});

test("deleting an asset refreshes what may show it: maps and cards too (#197)", async () => {
  const queryClient = new QueryClient();
  // A map and a card already loaded, whose image the deletion can remove.
  queryClient.setQueryData(["maps", "detail", "m1"], { id: "m1" });
  queryClient.setQueryData(["cards", "detail", "c1"], { id: "c1" });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useDeleteAsset(), { wrapper });

  await act(async () => {
    result.current.mutate("a.png");
  });

  await waitFor(() => {
    expect(queryClient.getQueryState(["maps", "detail", "m1"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["cards", "detail", "c1"])?.isInvalidated).toBe(true);
  });
});
