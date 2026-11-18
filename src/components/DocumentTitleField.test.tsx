// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { flushPendingSaves } from "@/lib/pendingSaves";
import { DocumentTitleField } from "./DocumentTitleField";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderField() {
  const rename = { mutateAsync: vi.fn(() => Promise.resolve()), isError: false, error: null };
  const view = render(<DocumentTitleField title="Arda" label="Nom de la map" rename={rename} />);
  return { rename, view, field: screen.getByLabelText("Nom de la map") };
}

test("a name typed, then the page left before the pause and without a blur, is saved (#614)", async () => {
  const { rename, view, field } = renderField();

  fireEvent.change(field, { target: { value: "Terre du Milieu" } });
  // No blur, and before the pause that saves: another page takes the field away.
  view.unmount();

  expect(rename.mutateAsync.mock.calls).toEqual([["Terre du Milieu"]]);
});

test("a name typed is saved before the world closes, and once only (#614)", async () => {
  vi.useFakeTimers();
  const { rename, view, field } = renderField();

  fireEvent.change(field, { target: { value: "Terre du Milieu" } });
  await act(() => flushPendingSaves());
  expect(rename.mutateAsync.mock.calls).toEqual([["Terre du Milieu"]]);

  // The pause, a blur, then the page left: nothing more is sent.
  await act(() => vi.advanceTimersByTimeAsync(600));
  fireEvent.blur(field);
  view.unmount();
  expect(rename.mutateAsync).toHaveBeenCalledTimes(1);
});
