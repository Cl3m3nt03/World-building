import type { TFunction } from "i18next";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  Baby,
  Crown,
  Eye,
  Gem,
  Ghost,
  GraduationCap,
  HandHeart,
  Handshake,
  Heart,
  HeartCrack,
  HouseHeart,
  Link2,
  type LucideIcon,
  Shield,
  Skull,
  Sparkles,
  Star,
  Swords,
  Users,
  UsersRound,
} from "lucide-react";
import { TYPE_ICONS } from "@/features/card-types";
import type { TranslationKey } from "@/i18n";
import type { RelationType } from "@/lib/bindings";

/** Names of the provided relation types (their `builtin` key). */
const BUILTIN_LABELS: Record<string, TranslationKey> = {
  parent: "trees.relations.parent",
  child: "trees.relations.child",
  sibling: "trees.relations.sibling",
  "half-sibling": "trees.relations.halfSibling",
  adopted: "trees.relations.adopted",
  "adoptive-parent": "trees.relations.adoptiveParent",
  "step-parent": "trees.relations.stepParent",
  "step-child": "trees.relations.stepChild",
  partner: "trees.relations.partner",
  spouse: "trees.relations.spouse",
  ex: "trees.relations.ex",
};

/** Icons a relation can have: the provided ones', a few more, and the card types'. */
export const RELATION_ICONS: Record<string, LucideIcon> = {
  "arrow-up": ArrowUp,
  "arrow-down": ArrowDown,
  "arrow-up-right": ArrowUpRight,
  "arrow-down-right": ArrowDownRight,
  users: Users,
  "users-round": UsersRound,
  "hand-heart": HandHeart,
  "house-heart": HouseHeart,
  heart: Heart,
  "heart-crack": HeartCrack,
  gem: Gem,
  handshake: Handshake,
  swords: Swords,
  "graduation-cap": GraduationCap,
  baby: Baby,
  crown: Crown,
  shield: Shield,
  skull: Skull,
  ghost: Ghost,
  eye: Eye,
  star: Star,
  sparkles: Sparkles,
  link: Link2,
  ...TYPE_ICONS,
};

export const RELATION_ICON_NAMES = Object.keys(RELATION_ICONS);

export function relationIcon(name: string): LucideIcon {
  return RELATION_ICONS[name] ?? Link2;
}

/** What a relation type is called, in the app's language. */
export function relationName(type: RelationType, t: TFunction): string {
  const key = type.builtin ? BUILTIN_LABELS[type.builtin] : undefined;
  return key ? t(key) : type.name;
}

/** Where a « + » sits around a node, and where the new node goes. */
export type Direction = "top" | "right" | "bottom" | "left";

/**
 * The side a relation's new node naturally goes to (from the node's bar,
 * where no « + » was picked): parents above, children below, the rest
 * beside.
 */
export function naturalDirection(type: RelationType | null): Direction {
  switch (type?.builtin) {
    case "parent":
    case "adoptive-parent":
    case "step-parent":
      return "top";
    case "child":
    case "adopted":
    case "step-child":
      return "bottom";
    default:
      return "right";
  }
}
