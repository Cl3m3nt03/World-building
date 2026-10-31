import { cn } from "cn";

/** Characters always kept at the end: the part of a path that tells it apart. */
const TAIL = 24;

/**
 * A long text (a folder path) cut in its middle when it lacks room: the start
 * takes the ellipsis, the end stays whole. The full text is in the tooltip.
 */
export function MiddleTruncate({ text, className }: { text: string; className?: string }) {
  const cut = Math.max(0, text.length - TAIL);
  return (
    <span title={text} className={cn("flex min-w-0", className)}>
      <span className="min-w-0 truncate whitespace-pre">{text.slice(0, cut)}</span>
      <span className="shrink-0 whitespace-pre">{text.slice(cut)}</span>
    </span>
  );
}
