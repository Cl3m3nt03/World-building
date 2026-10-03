import type { TextPart } from "@/lib/bindings";

/** A text with its matched words highlighted (a search's result). */
export function Marked({ parts }: { parts: TextPart[] }) {
  return parts.map((part, index) =>
    part.matched ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one text never move.
      <mark key={index} className="rounded-sm bg-primary/25 px-px text-foreground">
        {part.text}
      </mark>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one text never move.
      <span key={index}>{part.text}</span>
    ),
  );
}
