import { useId } from "react";
import type { MapText } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { arcGeometry, shownSize } from "../texts";

/**
 * A text of the map (M4 step 4.7), drawn in SVG along a path so that it can
 * bend in an arc, with its letter spacing; centred on its position.
 * Rendered into its Leaflet marker (MapView).
 */
export function MapTextView({
  text,
  zoomScale,
  selected,
}: {
  text: MapText;
  zoomScale: number;
  selected: boolean;
}) {
  const pathId = useId();
  const size = shownSize(text, zoomScale);
  const { width, height, path } = arcGeometry(text, size);
  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn(
        "pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 overflow-visible",
        selected && "rounded-sm outline-2 outline-primary outline-dashed",
      )}
    >
      <path id={pathId} d={path} fill="none" />
      <text
        className="fill-foreground"
        style={{
          fontFamily: text.style.font,
          fontSize: size,
          letterSpacing: `${text.style.spacing ?? 0}em`,
          paintOrder: "stroke",
          stroke: "var(--background)",
          strokeWidth: Math.max(size / 10, 2),
        }}
      >
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {text.text}
        </textPath>
      </text>
    </svg>
  );
}
