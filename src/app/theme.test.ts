// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useUiStore } from "./stores/ui";
import { initTheme, resolveTheme, useImposedTheme, useThemeSync } from "./theme";

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

describe("the corner radius (#616)", () => {
  const scale = () => document.documentElement.style.getPropertyValue("--bz-radius-scale");

  test("is set on <html> before the first render, then follows the setting", () => {
    useUiStore.setState({ cornerRadius: 40 });
    initTheme();
    expect(scale()).toBe("0.4");

    renderHook(() => useThemeSync());
    act(() => useUiStore.getState().setCornerRadius(0));
    expect(scale()).toBe("0");
    act(() => useUiStore.getState().setCornerRadius(150));
    expect(scale()).toBe("1.5");
    act(() => useUiStore.getState().setCornerRadius(100));
    expect(scale()).toBe("1");
  });
});
