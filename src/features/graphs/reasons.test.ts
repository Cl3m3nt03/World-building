import type { TFunction } from "i18next";
import { expect, it } from "vitest";
import { describeReason, relationNamer } from "./reasons";

// Says the key and its values, to check what is asked of the translations.
const t = ((key: string, values?: Record<string, unknown>) =>
  `${key} ${JSON.stringify(values ?? {})}`) as unknown as TFunction;
const titleOf = (id: string) => ({ a: "Aragorn", b: "Arathorn" })[id] ?? "?";
const relationName = relationNamer(
  [
    {
      id: "rel-parent",
      builtin: "parent",
      name: "",
      icon: "",
      inverseId: null,
      category: "family",
    },
  ],
  () => "Parent",
);

it("says a mention, once or several times", () => {
  expect(
    describeReason({ kind: "mention", from: "a", count: 1 }, ["a", "b"], titleOf, relationName, t),
  ).toBe('graphs.reasons.mention {"from":"Aragorn"}');
  expect(
    describeReason({ kind: "mention", from: "a", count: 3 }, ["a", "b"], titleOf, relationName, t),
  ).toContain('"count":3');
});

it("says a property, with its relation if it has one", () => {
  expect(
    describeReason(
      { kind: "property", from: "a", label: "Parents", relationTypeId: "rel-parent" },
      ["a", "b"],
      titleOf,
      relationName,
      t,
    ),
  ).toBe(
    'graphs.reasons.propertyRelation {"from":"Aragorn","to":"Arathorn","label":"Parents","relation":"parent"}',
  );
  expect(
    describeReason(
      { kind: "property", from: "a", label: "", relationTypeId: null },
      ["a", "b"],
      titleOf,
      relationName,
      t,
    ),
  ).toContain("graphs.reasons.propertyGone");
});

it("says a relation of a tree, typed or not", () => {
  const relation = {
    kind: "relation" as const,
    from: "b",
    to: "a",
    treeId: "t",
    treeTitle: "Maison",
  };
  expect(
    describeReason(
      { ...relation, relationTypeId: "rel-parent" },
      ["a", "b"],
      titleOf,
      relationName,
      t,
    ),
  ).toBe(
    'graphs.reasons.relation {"from":"Arathorn","to":"Aragorn","relation":"parent","tree":"Maison"}',
  );
  expect(
    describeReason({ ...relation, relationTypeId: null }, ["a", "b"], titleOf, relationName, t),
  ).toContain("graphs.reasons.relationUntyped");
});
