// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { assetUrl, useAssetUrl } from "@/lib/assets";
import type { ImportedAsset } from "@/lib/bindings";
import { IpcError } from "@/lib/ipc";
import { createQueryClient } from "@/lib/query";
import { AssetImage } from "./components/AssetImage";
import { useImportAsset } from "./hooks/useImportAsset";

const ID = `${"a".repeat(64)}.png`;

beforeEach(() => {
  mockConvertFileSrc("windows");
});

afterEach(() => {
  cleanup();
  clearMocks();
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

test("asset URLs go through the bzasset protocol", () => {
  expect(assetUrl(ID)).toBe(`http://bzasset.localhost/${ID}`);
  expect(renderHook(() => useAssetUrl(ID)).result.current).toBe(`http://bzasset.localhost/${ID}`);
  expect(renderHook(() => useAssetUrl(undefined)).result.current).toBeUndefined();
});

test("AssetImage renders the asset URL", () => {
  render(<AssetImage assetId={ID} alt="Portrait" />);
  expect(screen.getByRole("img", { name: "Portrait" }).getAttribute("src")).toBe(
    `http://bzasset.localhost/${ID}`,
  );
});

test("useImportAsset sends the path to import_asset", async () => {
  const imported: ImportedAsset = {
    asset: {
      id: ID,
      name: "portrait.png",
      kind: "image",
      mime: "image/png",
      size: 5,
      width: 1,
      height: 1,
      createdAt: "2026-09-26T10:00:00Z",
    },
    created: true,
  };
  let received: unknown;
  mockIPC((command, payload) => {
    if (command === "import_asset") {
      received = payload;
      return imported;
    }
    return undefined;
  });
  const { result } = renderHook(() => useImportAsset(), { wrapper });

  let asset: ImportedAsset | undefined;
  await act(async () => {
    asset = await result.current.mutateAsync("C:/Pictures/portrait.png");
  });

  expect(received).toMatchObject({ path: "C:/Pictures/portrait.png" });
  expect(asset).toEqual(imported);
});

test("useImportAsset surfaces a Rust error", async () => {
  mockIPC(() => {
    throw { code: "no_world_open", message: "import_asset" };
  });
  const { result } = renderHook(() => useImportAsset(), { wrapper });

  let failure: unknown;
  await act(async () => {
    failure = await result.current
      .mutateAsync("C:/Pictures/missing.png")
      .catch((error: unknown) => error);
  });

  expect(failure).toBeInstanceOf(IpcError);
  expect((failure as IpcError).appError.code).toBe("no_world_open");
});
