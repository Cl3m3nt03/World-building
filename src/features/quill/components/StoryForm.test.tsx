// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { StoryForm } from "./StoryForm";

const drawn: string[] = [];
vi.mock("../cover/Book3D", () => ({
  Book3D: ({ bookStyle }: { bookStyle: { color: string } }) => {
    drawn.push(bookStyle.color);
    return null;
  },
}));
vi.mock("@/features/media", () => ({ ImagePickerDialog: () => null }));

let frames: FrameRequestCallback[] = [];
beforeEach(() => {
  drawn.length = 0;
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(onSubmit = vi.fn()) {
  const { container } = render(
    <StoryForm
      initial={{
        title: "Livre",
        bookStyle: { color: "#112233", finish: "cloth" },
        cover: { assetId: null, titlePosition: "middle" },
      }}
      mode="edit"
      pending={false}
      error={null}
      onSubmit={onSubmit}
      onCancel={() => {}}
    />,
  );
  return container.querySelector('input[type="color"]') as HTMLInputElement;
}

test("dragging in the free colour picker redraws the book once per frame", () => {
  const picker = setup();
  drawn.length = 0;
  for (let i = 0; i < 30; i++) {
    fireEvent.change(picker, { target: { value: `#10${(10 + i).toString(16)}00` } });
  }
  expect(drawn).toHaveLength(0);
  act(() => {
    for (const frame of frames.splice(0)) frame(0);
  });
  expect(drawn).toEqual(["#102700"]);
});

test("the colour picked just before submitting is not lost", () => {
  const onSubmit = vi.fn();
  const picker = setup(onSubmit);
  fireEvent.change(picker, { target: { value: "#abcdef" } });
  fireEvent.submit(picker.closest("form") as HTMLFormElement);
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ bookStyle: { color: "#abcdef", finish: "cloth" } }),
  );
});
