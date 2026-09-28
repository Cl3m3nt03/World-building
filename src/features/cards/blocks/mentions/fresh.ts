import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/**
 * Mention nodes just created by the automatic links or "Link" (preference
 * "Animate new links"). The node view plays its animation once, then
 * forgets the node.
 */
const fresh = new WeakSet<ProseMirrorNode>();

export function markFresh(node: ProseMirrorNode): void {
  fresh.add(node);
}

/** Whether `node` was just created and has not played its animation yet. */
export function isFresh(node: ProseMirrorNode): boolean {
  return fresh.has(node);
}

/** The animation of `node` has played. */
export function forgetFresh(node: ProseMirrorNode): void {
  fresh.delete(node);
}
