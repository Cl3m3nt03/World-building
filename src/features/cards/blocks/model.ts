import type { JSONContent } from "@tiptap/react";

/**
 * A card's content: an ordered list of blocks, saved as JSON by the Rust
 * side (src-tauri/src/domain/content.rs checks the outline and derives the
 * plain text used by search).
 */
export type TextBlock = { id: string; type: "text"; doc: JSONContent };
/** An image of the media library, with a caption. `assetId` is null until one is chosen. */
export type ImageBlock = { id: string; type: "image"; assetId: string | null; caption: string };
export type Block = TextBlock | ImageBlock;
export type BlockType = Block["type"];

export function newId(): string {
  return crypto.randomUUID();
}

export function emptyTextBlock(): TextBlock {
  return { id: newId(), type: "text", doc: { type: "doc", content: [{ type: "paragraph" }] } };
}

export function emptyImageBlock(): ImageBlock {
  return { id: newId(), type: "image", assetId: null, caption: "" };
}

export function newBlock(type: BlockType): Block {
  switch (type) {
    case "text":
      return emptyTextBlock();
    case "image":
      return emptyImageBlock();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A saved block, or `null` if it is unknown or malformed. */
function readBlock(value: unknown): Block | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  if (value.type === "text" && isRecord(value.doc)) {
    return { id: value.id, type: "text", doc: value.doc as JSONContent };
  }
  if (value.type === "image") {
    return {
      id: value.id,
      type: "image",
      assetId: typeof value.assetId === "string" ? value.assetId : null,
      caption: typeof value.caption === "string" ? value.caption : "",
    };
  }
  return null;
}

/** Blocks of a saved content; unknown or malformed blocks are dropped. */
export function parseContent(json: string): Block[] {
  try {
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return [];
    return value.map(readBlock).filter((block): block is Block => block !== null);
  } catch {
    return [];
  }
}

/** `blocks` with the block at `from` moved to `to`. */
export function move<T>(blocks: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) {
    return blocks;
  }
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}
