// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import type { MapText } from "@/lib/bindings";
import { TextPanel } from "./components/TextPanel";

afterEach(cleanup);

const TEXT: MapText = {
  id: "t1",
  layerId: "l1",
  x: 10,
  y: 10,
  text: "Gondor",
  style: { font: "serif", size: 28, spacing: 0, arc: 0, scaleWithZoom: false },
};

/** Mirrors the page: every change is saved and fed back as the new prop. */
function Harness({ onSave }: { onSave: (text: MapText) => void }) {
  const [text, setText] = useState(TEXT);
  return (
    <TextPanel
      text={text}
      layers={[{ id: "l1", name: "Calque 1", visible: true }]}
      autoFocus={false}
      onChange={(patch) => {
        const next = { ...text, ...patch };
        setText(next);
        onSave(next);
      }}
      onDelete={() => {}}
    />
  );
}

test("typing a font size applies and saves it, partial values included", () => {
  const onSave = vi.fn();
  render(<Harness onSave={onSave} />);
  const field = screen.getByLabelText<HTMLInputElement>("Taille");

  // Clearing then typing "4" (below the minimum) must not reset the field.
  fireEvent.change(field, { target: { value: "" } });
  fireEvent.change(field, { target: { value: "4" } });
  expect(field.value).toBe("4");
  fireEvent.change(field, { target: { value: "42" } });

  expect(onSave).toHaveBeenLastCalledWith(
    expect.objectContaining({ style: expect.objectContaining({ size: 42 }) }),
  );
  expect(field.value).toBe("42");
});

test("an out-of-range size is clamped when leaving the field", () => {
  const onSave = vi.fn();
  render(<Harness onSave={onSave} />);
  const field = screen.getByLabelText<HTMLInputElement>("Taille");

  fireEvent.change(field, { target: { value: "500" } });
  expect(field.value).toBe("500");
  fireEvent.blur(field);

  expect(field.value).toBe("200");
  expect(onSave).toHaveBeenLastCalledWith(
    expect.objectContaining({ style: expect.objectContaining({ size: 200 }) }),
  );
});
