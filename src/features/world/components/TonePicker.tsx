import { Check, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Tone } from "@/lib/bindings";
import { MAX_TONES, TONES } from "../genres";

/**
 * The tones of a world (ADR 0013) as pills to switch on and off, beside its
 * main genre: up to six; once six are chosen the others wait. `collapsed`
 * starts folded behind a button, for a form where the choice is optional.
 */
export function TonePicker({
  value,
  onChange,
  collapsed = false,
}: {
  value: Tone[];
  onChange: (tones: Tone[]) => void;
  collapsed?: boolean;
}) {
  const { t } = useTranslation();
  const labelId = useId();
  const full = value.length >= MAX_TONES;
  const [unfolded, setUnfolded] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  // The button goes away when pressed: the focus moves on to the first tone.
  useEffect(() => {
    if (unfolded) groupRef.current?.querySelector("button")?.focus();
  }, [unfolded]);
  if (collapsed && !unfolded) {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <span className="text-sm font-medium">{t("tones.label")}</span>
        <button
          type="button"
          onClick={() => setUnfolded(true)}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 text-xs text-muted-foreground transition-[color,border-color] duration-(--bz-duration-fast) ease-atlas outline-none hover:border-primary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus aria-hidden className="size-3" />
          {t("tones.add")}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm font-medium">
        {t("tones.label")}
      </span>
      {/* biome-ignore lint/a11y/useSemanticElements: a group of toggle buttons, not a fieldset of inputs */}
      <div ref={groupRef} role="group" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        {TONES.map(({ value: tone, label }) => {
          const on = value.includes(tone);
          return (
            <button
              key={tone}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => onChange(on ? value.filter((v) => v !== tone) : [...value, tone])}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-(--bz-field) px-2.5 text-xs text-muted-foreground transition-[color,background-color,border-color] duration-(--bz-duration-fast) ease-atlas outline-none hover:border-[color-mix(in_oklab,var(--primary)_45%,var(--input))] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 aria-pressed:border-primary aria-pressed:bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] aria-pressed:text-foreground"
            >
              {on && <Check aria-hidden className="size-3" />}
              {t(label)}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t("tones.hint", { count: MAX_TONES })}</p>
    </div>
  );
}

/** A world's tones, read-only, as small pills (Home, world card). */
export function ToneList({ tones, className }: { tones: Tone[]; className?: string }) {
  const { t } = useTranslation();
  if (tones.length === 0) return null;
  const labels = new Map(TONES.map(({ value, label }) => [value, label]));
  return (
    <ul aria-label={t("tones.label")} className={className ?? "flex flex-wrap gap-1"}>
      {tones.map((tone) => {
        const label = labels.get(tone);
        return label ? (
          <li key={tone} className="rubric glass-veil rounded-full px-2.5 py-0.5">
            {t(label)}
          </li>
        ) : null;
      })}
    </ul>
  );
}
