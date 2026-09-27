import type { JSONContent } from "@tiptap/react";

/**
 * A card's content: an ordered list of blocks, saved as JSON by the Rust
 * side (src-tauri/src/domain/content.rs checks the outline and derives the
 * plain text used by search).
 */
export type TextBlock = { id: string; type: "text"; doc: JSONContent };
export type Block = TextBlock;
export type BlockType = Block["type"];

export function newId(): string {
  return crypto.randomUUID();
}

export function emptyTextBlock(): TextBlock {
  return { id: newId(), type: "text", doc: { type: "doc", content: [{ type: "paragraph" }] } };
}

/** Blocks of a saved content; unknown or malformed blocks are dropped. */
export function parseContent(json: string): Block[] {
  try {
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (block): block is Block =>
        typeof block === "object" &&
        block !== null &&
        typeof (block as Block).id === "string" &&
        (block as Block).type === "text",
    );
  } catch {
    return [];
  }
}

/** `blocks` with the block at `from` moved to `to`. */
export function move<T>(blocks: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length)
    return blocks;
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}
