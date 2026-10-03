import { Map as MapIcon } from "lucide-react";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import type { WikiPage } from "@/lib/bindings";
import { cn } from "@/lib/utils";

/** The icon of a wiki page: its card type's, or a map's. */
export function PageIcon({ page, className }: { page: WikiPage; className?: string }) {
  const types = useCardTypes();
  if (page.kind === "map") return <MapIcon aria-hidden className={cn("shrink-0", className)} />;
  const type = types.data?.find((candidate) => candidate.id === page.typeId);
  const Icon = typeIcon(type?.icon ?? "shapes");
  return (
    <Icon
      aria-hidden
      className={cn("shrink-0", className)}
      style={{ color: typeColor(type?.color ?? "slate") }}
    />
  );
}
