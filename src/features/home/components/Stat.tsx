/** One figure of the world: the number, its name, a fine line ending in a gold dot (after vvd). */
export function Stat({ value, label }: { value: number | undefined; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-heading text-2xl leading-none font-bold lining-nums tabular-nums">
        {value === undefined ? "–" : value.toLocaleString()}
      </span>
      <span aria-hidden className="relative h-px w-20 bg-border-strong">
        <span className="absolute -top-0.5 right-0 size-1.5 rounded-full bg-primary" />
      </span>
      <span className="on-backdrop text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
