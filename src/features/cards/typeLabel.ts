import type { CardType } from "@/lib/bindings";

/** "Lieu › Ville" for a subtype, the name for a type. */
export function typeLabel(type: CardType, all: CardType[]): string {
  const parent = type.parentId ? all.find((other) => other.id === type.parentId) : undefined;
  return parent ? `${parent.name} › ${type.name}` : type.name;
}
