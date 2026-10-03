import type { TFunction } from "i18next";
import type { EdgeReason, RelationType } from "@/lib/bindings";

/**
 * Why two cards are linked in the graph, said in words (M7.5 step 7.5.5,
 * ADR 0007): « Aragorn la cite dans son texte », « Arathorn : parent de
 * Aragorn — propriété Parents », « Arwen : épouse de Aragorn — arbre Maison
 * d'Elendil ». Pure, tested in
 * reasons.test.ts.
 */
export function describeReason(
  reason: EdgeReason,
  /** The two cards of the link (a property names only its holder). */
  pair: readonly [string, string],
  titleOf: (id: string) => string,
  relationName: (id: string | null) => string | null,
  t: TFunction,
): string {
  switch (reason.kind) {
    case "mention":
      return reason.count > 1
        ? t("graphs.reasons.mentionMany", { from: titleOf(reason.from), count: reason.count })
        : t("graphs.reasons.mention", { from: titleOf(reason.from) });
    case "property": {
      const relation = relationName(reason.relationTypeId);
      const label = reason.label || t("graphs.reasons.propertyGone");
      const value = pair[0] === reason.from ? pair[1] : pair[0];
      return relation
        ? t("graphs.reasons.propertyRelation", {
            from: titleOf(reason.from),
            to: titleOf(value),
            label,
            relation,
          })
        : t("graphs.reasons.property", { from: titleOf(reason.from), label });
    }
    case "relation": {
      const relation = relationName(reason.relationTypeId);
      return relation
        ? t("graphs.reasons.relation", {
            from: titleOf(reason.from),
            to: titleOf(reason.to),
            relation,
            tree: reason.treeTitle,
          })
        : t("graphs.reasons.relationUntyped", {
            from: titleOf(reason.from),
            to: titleOf(reason.to),
            tree: reason.treeTitle,
          });
    }
  }
}

/** The name of a relation type of the world, translated for a provided one. */
export function relationNamer(
  types: readonly RelationType[],
  name: (type: RelationType) => string,
): (id: string | null) => string | null {
  const byId = new Map(types.map((type) => [type.id, type]));
  return (id) => {
    const type = id ? byId.get(id) : undefined;
    return type ? name(type).toLocaleLowerCase() : null;
  };
}
