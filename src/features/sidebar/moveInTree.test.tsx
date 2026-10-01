// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import type { DocumentTree, TreeDocument } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { treeKey, useDocumentTree, useMoveInTree } from "./hooks/useDocumentTree";

function doc(id: string, sortOrder: number): TreeDocument {
  return {
    id,
    kind: "card",
    title: id,
    folderId: null,
    parentId: null,
    sortOrder,
    pinnedOrder: null,
    createdAt: "2026-10-01T10:00:00Z",
    typeId: null,
    imageAssetId: null,
  };
}

const BEFORE: DocumentTree = { folders: [], documents: [doc("a", 0), doc("b", 1)] };

afterEach(() => clearMocks());

function setup(answer: (command: string, args: unknown) => unknown) {
  const calls: { command: string; args: unknown }[] = [];
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  mockIPC(async (command, args) => {
    calls.push({ command, args });
    if (command === "move_document") await held;
    return answer(command, args);
  });
  const queryClient = createQueryClient();
  queryClient.setQueryData(treeKey(), BEFORE);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  // The sidebar watches the tree, so invalidating it fetches it again.
  const { result: hooks } = renderHook(() => ({ tree: useDocumentTree(), move: useMoveInTree() }), {
    wrapper,
  });
  const result = {
    get current() {
      return hooks.current.move;
    },
  };
  const order = () =>
    [...(queryClient.getQueryData<DocumentTree>(treeKey())?.documents ?? [])]
      .sort((x, y) => x.sortOrder - y.sortOrder)
      .map((d) => d.id);
  return { calls, release, result, order };
}

test("shows the move at once, sends it, then takes the Rust's tree", async () => {
  const after: DocumentTree = { folders: [], documents: [doc("b", 0), doc("a", 1)] };
  const { calls, release, result, order } = setup((command) =>
    command === "document_tree" ? after : null,
  );

  act(() =>
    result.current.mutate({ kind: "document", id: "a", place: { kind: "root" }, index: 1 }),
  );
  // Before the Rust answers.
  await waitFor(() => expect(order()).toEqual(["b", "a"]));
  expect(calls[0]).toEqual({
    command: "move_document",
    args: { id: "a", place: { kind: "root" }, index: 1 },
  });

  release();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
});

test("a refused move goes back to the Rust's tree and keeps the error", async () => {
  const { release, result, order } = setup((command) => {
    if (command === "move_document") throw { code: "invalid_input", message: "cycle" };
    return BEFORE;
  });

  act(() =>
    result.current.mutate({ kind: "document", id: "a", place: { kind: "root" }, index: 1 }),
  );
  await waitFor(() => expect(order()).toEqual(["b", "a"]));
  release();

  await waitFor(() => expect(result.current.isError).toBe(true));
  // The tree is fetched again: the move is undone.
  await waitFor(() => expect(order()).toEqual(["a", "b"]));
});
