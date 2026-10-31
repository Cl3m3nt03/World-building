// @vitest-environment jsdom
import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, type Mock, test, vi } from "vitest";
import { useHistoryKeys } from "./useHistoryKeys";

let container: HTMLElement;
let heard: Mock<(key: string, shift: boolean) => void>;

function mount(child: string): HTMLElement {
  const parent = document.createElement("div");
  parent.innerHTML = child;
  document.body.append(parent);
  return parent.firstElementChild as HTMLElement;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  heard = vi.fn();
  container.addEventListener("keydown", (event) => {
    if (event.target === container) heard(event.key, event.shiftKey);
  });
  renderHook(() => useHistoryKeys(container));
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

test("Ctrl+Z and Ctrl+Y that Excalidraw did not hear reach it from anywhere", () => {
  const button = mount("<button>Recentrer</button>");
  fireEvent.keyDown(button, { key: "z", ctrlKey: true });
  fireEvent.keyDown(document.body, { key: "Z", ctrlKey: true, shiftKey: true });
  fireEvent.keyDown(button, { key: "y", metaKey: true });
  expect(heard.mock.calls).toEqual([
    ["z", false],
    ["Z", true],
    ["y", false],
  ]);
});

test("the keys of a field or a dialog stay there, and other keys are left alone", () => {
  fireEvent.keyDown(mount("<input />"), { key: "z", ctrlKey: true });
  fireEvent.keyDown(mount("<textarea></textarea>"), { key: "z", ctrlKey: true });
  fireEvent.keyDown(
    mount('<div role="dialog"><button>OK</button></div>').firstElementChild as Element,
    {
      key: "z",
      ctrlKey: true,
    },
  );
  fireEvent.keyDown(mount("<button>Recentrer</button>"), { key: "z" });
  fireEvent.keyDown(mount("<button>Recentrer</button>"), { key: "a", ctrlKey: true });
  expect(heard).not.toHaveBeenCalled();
});

test("what Excalidraw hears itself is not sent twice", () => {
  const inside = document.createElement("button");
  container.append(inside);
  inside.addEventListener("keydown", (event) => event.stopPropagation());
  fireEvent.keyDown(inside, { key: "z", ctrlKey: true });
  expect(heard).not.toHaveBeenCalled();
  fireEvent.keyDown(container, { key: "z", ctrlKey: true });
  expect(heard).toHaveBeenCalledTimes(1);
});
