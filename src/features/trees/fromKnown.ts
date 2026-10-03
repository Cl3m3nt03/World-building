import type { KnownRelation, RelationType, TreeEdge, VariantContent } from "@/lib/bindings";
import { NODE_HEIGHT, NODE_WIDTH } from "./content";

/**
 * A tree filled from what the world already knows (ADR 0007, M7.5 step
 * 7.5.4): the cards linked by known relations, placed by generations, and
 * their relations. Only what is missing is added; what the tree already
 * shows stays where it is. Pure functions, tested in fromKnown.test.ts.
 *
 * A relation says `to` is `relationTypeId` of `from` (as a tree link: its
 * target is that relation of its source).
 */

const GAP = { x: 72, y: 96 };

/** Provided relations where `to` is a child of `from` (the Rust side says them this way). */
const CHILD_LIKE = new Set(["child", "adopted", "step-child"]);
/** Provided relations where `to` is a parent of `from` (said the other way round). */
const PARENT_LIKE = new Set(["parent", "adoptive-parent", "step-parent"]);
/** Provided relations between people of one generation. */
const SAME_LEVEL = new Set(["sibling", "half-sibling"]);

type Role = "child" | "parent" | "level" | "other";

function roleOf(relation: KnownRelation, types: ReadonlyMap<string, RelationType>): Role {
  const type = relation.relationTypeId ? types.get(relation.relationTypeId) : undefined;
  if (!type) return "other";
  if (type.builtin && CHILD_LIKE.has(type.builtin)) return "child";
  if (type.builtin && PARENT_LIKE.has(type.builtin)) return "parent";
  if (type.category === "couple" || (type.builtin && SAME_LEVEL.has(type.builtin))) {
    return "level";
  }
  return "other";
}

/** A tree is empty when it has nothing but its first, blank node. */
export function isBlank(content: VariantContent): boolean {
  return (
    content.edges.length === 0 &&
    content.annotations.length === 0 &&
    content.nodes.every((node) => node.cardId === null && node.label === "") &&
    content.nodes.length <= 1
  );
}

/** The cards the known relations link, in the order they first appear. */
export function knownCards(known: readonly KnownRelation[]): string[] {
  const cards: string[] = [];
  const seen = new Set<string>();
  for (const relation of known) {
    for (const card of [relation.from, relation.to]) {
      if (!seen.has(card)) {
        seen.add(card);
        cards.push(card);
      }
    }
  }
  return cards;
}

/**
 * Generation of each card: a child one below its parents, partners and
 * siblings side by side; the oldest generation is 0. A loop (A parent of B
 * parent of A) stops growing after as many rounds as there are cards.
 */
export function generations(
  cards: readonly string[],
  known: readonly KnownRelation[],
  types: ReadonlyMap<string, RelationType>,
): Map<string, number> {
  const level = new Map(cards.map((card) => [card, 0]));
  const below: [string, string][] = [];
  const beside: [string, string][] = [];
  for (const relation of known) {
    const role = roleOf(relation, types);
    if (role === "child") below.push([relation.from, relation.to]);
    else if (role === "parent") below.push([relation.to, relation.from]);
    else if (role === "level") beside.push([relation.from, relation.to]);
  }
  for (let round = 0; round <= cards.length; round++) {
    let changed = false;
    for (const [parent, child] of below) {
      const wanted = (level.get(parent) ?? 0) + 1;
      if ((level.get(child) ?? 0) < wanted && wanted <= cards.length) {
        level.set(child, wanted);
        changed = true;
      }
    }
    for (const [a, b] of beside) {
      const top = Math.max(level.get(a) ?? 0, level.get(b) ?? 0);
      for (const card of [a, b]) {
        if ((level.get(card) ?? 0) < top) {
          level.set(card, top);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  const lowest = Math.min(0, ...level.values());
  for (const [card, value] of level) level.set(card, value - lowest);
  return level;
}

/**
 * Where each card goes: one row per generation, centred on x = 0; in a row,
 * children under their parents, partners next to each other.
 */
export function layout(
  cards: readonly string[],
  known: readonly KnownRelation[],
  types: ReadonlyMap<string, RelationType>,
): Map<string, { x: number; y: number }> {
  const level = generations(cards, known, types);
  const parents = new Map<string, string[]>();
  const partners = new Map<string, string>();
  for (const relation of known) {
    const role = roleOf(relation, types);
    const [parent, child] =
      role === "child"
        ? [relation.from, relation.to]
        : role === "parent"
          ? [relation.to, relation.from]
          : [null, null];
    if (parent && child) parents.set(child, [...(parents.get(child) ?? []), parent]);
    const type = relation.relationTypeId ? types.get(relation.relationTypeId) : undefined;
    if (type?.category === "couple" && !partners.has(relation.from) && !partners.has(relation.to)) {
      partners.set(relation.from, relation.to);
      partners.set(relation.to, relation.from);
    }
  }
  const rows = new Map<number, string[]>();
  for (const card of cards) {
    const row = level.get(card) ?? 0;
    rows.set(row, [...(rows.get(row) ?? []), card]);
  }
  const place = new Map<string, { x: number; y: number }>();
  const appearance = new Map(cards.map((card, index) => [card, index]));
  for (const row of [...rows.keys()].sort((a, b) => a - b)) {
    const members = rows.get(row) ?? [];
    // Under their parents: by the mean x of the parents already placed.
    const anchor = (card: string) => {
      const xs = (parents.get(card) ?? [])
        .map((parent) => place.get(parent)?.x)
        .filter((x): x is number => x !== undefined);
      return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.POSITIVE_INFINITY;
    };
    const sorted = [...members].sort(
      (a, b) => anchor(a) - anchor(b) || (appearance.get(a) ?? 0) - (appearance.get(b) ?? 0),
    );
    // Partners side by side: each one right after the first of the two.
    const ordered: string[] = [];
    for (const card of sorted) {
      if (ordered.includes(card)) continue;
      ordered.push(card);
      const partner = partners.get(card);
      if (partner && members.includes(partner) && !ordered.includes(partner)) {
        ordered.push(partner);
      }
    }
    const step = NODE_WIDTH + GAP.x;
    ordered.forEach((card, index) => {
      place.set(card, {
        x: (index - (ordered.length - 1) / 2) * step,
        y: row * (NODE_HEIGHT + GAP.y),
      });
    });
  }
  return place;
}

/** Whether the tree already says this relation (either way, or through a junction). */
function said(content: VariantContent, cardOf: ReadonlyMap<string, string | null>) {
  const keys = new Set<string>();
  const ends = new Map<string, string[]>();
  const endsOf = (edge: TreeEdge, depth: number): string[] => {
    const known = ends.get(edge.id);
    if (known) return known;
    let from: string[] = [];
    if (edge.source.kind === "node") {
      const card = cardOf.get(edge.source.id);
      from = card ? [card] : [];
    } else if (depth < 8) {
      const parent = content.edges.find((each) => each.id === edge.source.id);
      if (parent) {
        const target = cardOf.get(parent.target);
        from = [...endsOf(parent, depth + 1), ...(target ? [target] : [])];
      }
    }
    ends.set(edge.id, from);
    return from;
  };
  for (const edge of content.edges) {
    const to = cardOf.get(edge.target);
    if (!to) continue;
    for (const from of endsOf(edge, 0)) {
      keys.add(`${from}|${to}`);
      keys.add(`${to}|${from}`);
    }
  }
  return (relation: KnownRelation) => keys.has(`${relation.from}|${relation.to}`);
}

/**
 * The tree with the known relations it lacks: a node for each card it does
 * not show yet (placed by generations, beside what is already drawn), and a
 * link for each relation between two cards it does not link yet. A blank
 * tree loses its blank node. A child of two partners hangs from their link.
 */
export function addKnown(
  content: VariantContent,
  known: readonly KnownRelation[],
  relationTypes: readonly RelationType[],
  newId: () => string,
): VariantContent {
  const types = new Map(relationTypes.map((type) => [type.id, type]));
  const base = isBlank(content) ? { ...content, nodes: [] } : content;
  const nodeOf = new Map<string, string>();
  for (const node of base.nodes) {
    if (node.cardId && !nodeOf.has(node.cardId)) nodeOf.set(node.cardId, node.id);
  }
  const cardOf = new Map(base.nodes.map((node) => [node.id, node.cardId]));
  const isSaid = said(base, cardOf);
  const missing = known.filter((relation) => !isSaid(relation));
  if (missing.length === 0) return content;

  // New cards: laid out among themselves, beside the drawing.
  const newCards = knownCards(missing).filter((card) => !nodeOf.has(card));
  const placed = layout(newCards, missing, types);
  const right = base.nodes.length > 0 ? Math.max(...base.nodes.map((node) => node.x ?? 0)) : null;
  const left = Math.min(0, ...[...placed.values()].map((point) => point.x));
  const shift = right === null ? 0 : right + NODE_WIDTH + GAP.x * 2 - left;
  const nodes = [...base.nodes];
  for (const card of newCards) {
    const id = newId();
    const point = placed.get(card) ?? { x: 0, y: 0 };
    nodeOf.set(card, id);
    nodes.push({ id, cardId: card, label: "", x: point.x + shift, y: point.y });
  }

  // Links: partners first, so that their children can hang from them.
  const edges = [...base.edges];
  const coupleEdge = new Map<string, string>();
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const edge of base.edges) {
    const type = edge.relationTypeId ? types.get(edge.relationTypeId) : undefined;
    const from = edge.source.kind === "node" ? cardOf.get(edge.source.id) : null;
    const to = cardOf.get(edge.target);
    if (type?.category === "couple" && from && to) coupleEdge.set(pairKey(from, to), edge.id);
  }
  const link = (relation: KnownRelation) => {
    const source = nodeOf.get(relation.from);
    const target = nodeOf.get(relation.to);
    if (!source || !target) return null;
    const edge: TreeEdge = {
      id: newId(),
      source: { kind: "node", id: source },
      target,
      relationTypeId: relation.relationTypeId,
      lineStyle: "solid",
    };
    edges.push(edge);
    return edge;
  };
  const rest: KnownRelation[] = [];
  for (const relation of missing) {
    const type = relation.relationTypeId ? types.get(relation.relationTypeId) : undefined;
    if (type?.category === "couple") {
      const edge = link(relation);
      if (edge) coupleEdge.set(pairKey(relation.from, relation.to), edge.id);
    } else {
      rest.push(relation);
    }
  }
  // A child of two partners, by the same relation, hangs from their link.
  const byChild = new Map<string, KnownRelation[]>();
  for (const relation of rest) {
    if (roleOf(relation, types) !== "child") continue;
    const key = `${relation.to}|${relation.relationTypeId}`;
    byChild.set(key, [...(byChild.get(key) ?? []), relation]);
  }
  const hung = new Set<KnownRelation>();
  for (const pair of byChild.values()) {
    const [first, second] = pair;
    if (pair.length !== 2 || !first || !second) continue;
    const couple = coupleEdge.get(pairKey(first.from, second.from));
    const target = nodeOf.get(first.to);
    if (!couple || !target) continue;
    edges.push({
      id: newId(),
      source: { kind: "edge", id: couple },
      target,
      relationTypeId: first.relationTypeId,
      lineStyle: "solid",
    });
    hung.add(first);
    hung.add(second);
  }
  for (const relation of rest) {
    if (!hung.has(relation)) link(relation);
  }
  return { ...base, nodes, edges };
}
