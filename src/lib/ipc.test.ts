import { describe, expect, test } from "vitest";
import { errorDetail, errorKey, IpcError, unwrap } from "./ipc";

describe("unwrap", () => {
  test("returns the data of a successful command", async () => {
    await expect(unwrap(Promise.resolve({ status: "ok", data: 42 }))).resolves.toBe(42);
  });

  test("throws an IpcError carrying the Rust error", async () => {
    const result = unwrap(
      Promise.resolve({
        status: "error",
        error: { code: "path_unavailable", message: "config: no home" },
      } as const),
    );
    await expect(result).rejects.toBeInstanceOf(IpcError);
    await expect(result).rejects.toMatchObject({
      appError: { code: "path_unavailable", message: "config: no home" },
    });
  });
});

describe("error translation", () => {
  test("a Rust error maps to its i18n key and keeps its detail", () => {
    const error = new IpcError({ code: "io", message: "disk full" });
    expect(errorKey(error)).toBe("errors.io");
    expect(errorDetail(error)).toBe("disk full");
  });

  test("anything else is an unknown error", () => {
    expect(errorKey(new Error("boom"))).toBe("errors.unknown");
    expect(errorDetail(new Error("boom"))).toBe("boom");
    expect(errorKey("oops")).toBe("errors.unknown");
    expect(errorDetail("oops")).toBeUndefined();
  });
});
