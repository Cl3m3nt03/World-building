import { useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Number field for a font size. The typed text lives in a local draft so that
 * intermediate values ("4" on the way to "42") are never rejected: in-range
 * numbers are applied as typed, and the draft is clamped on blur or Enter.
 */
export function SizeInput({
  id,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (size: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    const size = draft.trim() === "" || Number.isNaN(parsed) ? value : clamp(parsed, min, max);
    setDraft(null);
    if (size !== value) onChange(size);
  };

  return (
    <Input
      id={id}
      type="number"
      min={min}
      max={max}
      value={draft ?? value}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const size = Number(text);
        if (text.trim() !== "" && Number.isInteger(size) && size >= min && size <= max) {
          onChange(size);
        }
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
      className="h-8"
    />
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
