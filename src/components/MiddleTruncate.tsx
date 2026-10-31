import { cn } from "cn";

/** Characters always kept at the end: the part of a path that tells it apart. */
const TAIL = 24;

/**
 * A long text (a folder path) cut in its middle when it lacks room: the start
 * takes the ellipsis, the end stays whole. The full text is in the tooltip.
 */
export function MiddleTruncate({
  text,
  className,
  hidden = false,
}: {
  text: string;
  className?: string;
  /** For screen readers, when a field right there already holds the text. */
  hidden?: boolean;
}) {
  // By characters: a slice by code units could split an emoji at the cut.
  const characters = Array.from(text);
  const cut = Math.max(0, characters.length - TAIL);
  return (
    <span title={text} aria-hidden={hidden || undefined} className={cn("flex min-w-0", className)}>
      <span className="min-w-0 truncate whitespace-pre">{characters.slice(0, cut).join("")}</span>
      <span className="shrink-0 whitespace-pre">{characters.slice(cut).join("")}</span>
    </span>
  );
}
