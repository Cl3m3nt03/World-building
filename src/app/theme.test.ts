// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { initTheme, resolveTheme, useImposedTheme } from "./theme";

describe("resolveTheme", () => {
  test("explicit preferences win over the system", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  test("system follows the OS preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("an imposed mode", () => {
  const root = document.documentElement;

  test("wins over the preference while imposed", () => {
    initTheme();
    expect(root.dataset.theme).toBe("light");
    const world = renderHook(({ theme }) => useImposedTheme(theme), {
      initialProps: { theme: "dark" as "dark" | null },
    });
    expect(root.dataset.theme).toBe("dark");
    world.rerender({ theme: null });
    expect(root.dataset.theme).toBe("light");
    world.rerender({ theme: "dark" });
    world.unmount();
    expect(root.dataset.theme).toBe("light");
  });
});
