import type { JSONContent } from "@tiptap/react";
import { ABILITIES, type Ability, MAX_SCORE, MIN_SCORE, SKILLS, type Skill } from "./stats/rules";

/**
 * A card's content: an ordered list of blocks, saved as JSON by the Rust
 * side (src-tauri/src/domain/content.rs checks the outline and derives the
 * plain text used by search).
 */
export type TextBlock = {
  id: string;
  type: "text";
  doc: JSONContent;
  /** Help question of a guided template section, shown until the section is written. */
  prompt?: string;
};
/** An image of a gallery: a media library image with its own caption. */
export type GalleryImage = { id: string; assetId: string; caption: string };
/**
 * Images of the media library shown one at a time, with arrows and
 * thumbnails (M3 step 3.10). Empty until images are chosen.
 */
export type ImageBlock = { id: string; type: "image"; images: GalleryImage[] };
/** Most images in one image block (also checked by the Rust side). */
export const MAX_GALLERY_IMAGES = 50;
/** An action of a 5e stat block ("Épée longue", "Attaque au corps à corps…"). */
export type StatAction = { id: string; name: string; description: string };
/** A D&D 5e character or creature sheet. */
export type Stats5eBlock = {
  id: string;
  type: "stats5e";
  abilities: Record<Ability, number>;
  armorClass: number | null;
  hitPoints: number | null;
  /** Free text, e.g. "5d8 + 10". */
  hitDice: string;
  /** Free text, e.g. "9 m". */
  speed: string;
  proficiencyBonus: number;
  /** Skills the character is proficient in. */
  skills: Skill[];
  actions: StatAction[];
};
export type Block = TextBlock | ImageBlock | Stats5eBlock;
export type BlockType = Block["type"];

export function newId(): string {
  return crypto.randomUUID();
}

export function emptyTextBlock(): TextBlock {
  return { id: newId(), type: "text", doc: { type: "doc", content: [{ type: "paragraph" }] } };
}

export function emptyImageBlock(): ImageBlock {
  return { id: newId(), type: "image", images: [] };
}

export function emptyStats5eBlock(): Stats5eBlock {
  return {
    id: newId(),
    type: "stats5e",
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    armorClass: null,
    hitPoints: null,
    hitDice: "",
    speed: "",
    proficiencyBonus: 2,
    skills: [],
    actions: [],
  };
}

export function newBlock(type: BlockType): Block {
  switch (type) {
    case "text":
      return emptyTextBlock();
    case "image":
      return emptyImageBlock();
    case "stats5e":
      return emptyStats5eBlock();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function wholeNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isInteger(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** A saved 5e stat block, with defaults for anything missing or out of range. */
function readStats5e(id: string, value: Record<string, unknown>): Stats5eBlock {
  const block = emptyStats5eBlock();
  const abilities = isRecord(value.abilities) ? value.abilities : {};
  const knownSkills: readonly string[] = SKILLS.map((skill) => skill.key);
  return {
    ...block,
    id,
    abilities: Object.fromEntries(
      ABILITIES.map((ability) => [
        ability,
        wholeNumber(abilities[ability], 10, MIN_SCORE, MAX_SCORE),
      ]),
    ) as Record<Ability, number>,
    armorClass: optionalNumber(value.armorClass),
    hitPoints: optionalNumber(value.hitPoints),
    hitDice: text(value.hitDice),
    speed: text(value.speed),
    proficiencyBonus: wholeNumber(value.proficiencyBonus, 2, 0, 20),
    skills: Array.isArray(value.skills)
      ? (value.skills.filter(
          (skill) => typeof skill === "string" && knownSkills.includes(skill),
        ) as Skill[])
      : [],
    actions: Array.isArray(value.actions)
      ? value.actions.filter(isRecord).map((action) => ({
          id: typeof action.id === "string" ? action.id : newId(),
          name: text(action.name),
          description: text(action.description),
        }))
      : [],
  };
}

/**
 * A saved image block. One saved before galleries (`assetId` and `caption`)
 * becomes a gallery of that image; images without an asset are dropped.
 */
function readImageBlock(id: string, value: Record<string, unknown>): ImageBlock {
  const saved = Array.isArray(value.images)
    ? value.images
    : [{ id: newId(), assetId: value.assetId, caption: value.caption }];
  const images = saved
    .filter(isRecord)
    .filter((image) => typeof image.assetId === "string" && image.assetId !== "")
    .slice(0, MAX_GALLERY_IMAGES)
    .map((image) => ({
      id: typeof image.id === "string" && image.id !== "" ? image.id : newId(),
      assetId: image.assetId as string,
      caption: text(image.caption),
    }));
  return { id, type: "image", images };
}

/** A saved block, or `null` if it is unknown or malformed. */
function readBlock(value: unknown): Block | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  if (value.type === "text" && isRecord(value.doc)) {
    const block: TextBlock = { id: value.id, type: "text", doc: value.doc as JSONContent };
    if (typeof value.prompt === "string" && value.prompt !== "") block.prompt = value.prompt;
    return block;
  }
  if (value.type === "stats5e") return readStats5e(value.id, value);
  if (value.type === "image") return readImageBlock(value.id, value);
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
