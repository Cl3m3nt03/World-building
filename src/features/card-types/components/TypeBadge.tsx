import type { CardType } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { typeColor } from "../colors";
import { typeIcon } from "../icons";

const SIZES = {
  sm: { tile: "size-6 rounded-sm", icon: "size-3.5" },
  md: { tile: "size-7 rounded-md", icon: "size-4" },
  lg: { tile: "size-14 rounded-lg", icon: "size-7" },
} as const;

/**
 * A type's icon on a tile tinted with its colour (types screen, V2-3.6):
 * the colour reads at a glance, in both themes (the type tokens are tuned
 * for each).
 */
export function TypeBadge({
  type,
  size = "md",
  className,
}: {
  type: Pick<CardType, "icon" | "color">;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Icon = typeIcon(type.icon);
  const color = typeColor(type.color);
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center", SIZES[size].tile, className)}
      style={{
        color,
        backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 28%, transparent)`,
      }}
    >
      <Icon className={SIZES[size].icon} strokeWidth={size === "lg" ? 1.5 : 2} />
    </span>
  );
}
