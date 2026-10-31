import {
  ChartGantt,
  LayoutGrid,
  type LucideIcon,
  Map as MapIcon,
  Network,
  Share2,
} from "lucide-react";
import { typeColor, typeIcon } from "@/features/card-types";
import type { CardType, DocumentKind } from "@/lib/bindings";

const KIND_ICONS: Partial<Record<DocumentKind, LucideIcon>> = {
  map: MapIcon,
  graph: Share2,
  tree: Network,
  canvas: LayoutGrid,
  timeline: ChartGantt,
};

/** The icon of a document, in the tree as in the pins: its kind's, or its card type's. */
export function documentVisual(
  kind: DocumentKind,
  type: CardType | undefined,
): { Icon: LucideIcon; color?: string } {
  const Icon = KIND_ICONS[kind];
  if (Icon) return { Icon };
  return { Icon: typeIcon(type?.icon ?? "shapes"), color: typeColor(type?.color ?? "slate") };
}
