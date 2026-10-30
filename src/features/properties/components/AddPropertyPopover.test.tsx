// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { createQueryClient } from "@/lib/query";
import { AddPropertyPopover } from "./AddPropertyPopover";

beforeEach(() => mockIPC(() => null));

afterEach(() => {
  cleanup();
  clearMocks();
});

test("the window never goes past the app's window: it scrolls instead (#493)", async () => {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AddPropertyPopover owner={{ on: "card", cardId: "aragorn" }} types={[]} />
    </QueryClientProvider>,
  );

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une propriété" }));
  });

  const window = screen.getByRole("dialog");
  expect(window.className).toContain("max-h-(--radix-popover-content-available-height)");
  expect(window.className).toContain("overflow-y-auto");
});
