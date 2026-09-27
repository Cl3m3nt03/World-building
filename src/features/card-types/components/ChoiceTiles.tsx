import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Choice<T extends string> = {
  value: T;
  /** Accessible name of the tile. */
  label: string;
  content: ReactNode;
};

type ChoiceTilesProps<T extends string> = {
  label: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  tileClassName?: string;
};

/**
 * A radio group drawn as tiles: one tab stop, arrow keys to move, the
 * selection follows focus (Radix RadioGroup).
 */
export function ChoiceTiles<T extends string>({
  label,
  choices,
  value,
  onChange,
  className,
  tileClassName,
}: ChoiceTilesProps<T>) {
  return (
    <RadioGroupPrimitive.Root
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        const choice = choices.find((c) => c.value === next);
        if (choice) onChange(choice.value);
      }}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {choices.map((choice) => (
        <RadioGroupPrimitive.Item
          key={choice.value}
          value={choice.value}
          aria-label={choice.label}
          title={choice.label}
          className={cn(
            "flex items-center justify-center rounded-lg border border-border bg-transparent text-muted-foreground transition outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:bg-secondary data-[state=checked]:text-foreground",
            tileClassName,
          )}
        >
          {choice.content}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
