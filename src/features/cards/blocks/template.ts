import type { JSONContent } from "@tiptap/react";
import type { CardType, TemplateSection } from "@/lib/bindings";
import { type Block, newId, type TextBlock } from "./model";

/**
 * The guided template a card of `type` uses: its own, or, for a subtype
 * without one, its parent type's.
 */
export function effectiveTemplate(
  type: CardType | undefined,
  types: CardType[],
): TemplateSection[] {
  if (!type) return [];
  if (type.guidedTemplate.length > 0 || type.parentId === null) return type.guidedTemplate;
  return types.find((candidate) => candidate.id === type.parentId)?.guidedTemplate ?? [];
}

function headingsOf(node: JSONContent, out: Set<string>) {
  if (node.type === "heading") {
    const text = (node.content ?? []).map((child) => child.text ?? "").join("");
    out.add(normalize(text));
  }
  for (const child of node.content ?? []) headingsOf(child, out);
}

function normalize(text: string): string {
  return text.trim().toLocaleLowerCase();
}

/** A text block titled `title`, with `prompt` shown in its empty first paragraph. */
function sectionBlock(section: TemplateSection): TextBlock {
  const block: TextBlock = {
    id: newId(),
    type: "text",
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: section.title }] },
        { type: "paragraph" },
      ],
    },
  };
  if (section.prompt.trim() !== "") block.prompt = section.prompt.trim();
  return block;
}

/**
 * The blocks a guided template adds after `blocks`: one titled text block
 * per section. Nothing existing is changed or removed, and a section whose
 * title is already a heading of the card is skipped (applying twice adds
 * nothing).
 */
export function templateBlocks(blocks: Block[], sections: TemplateSection[]): TextBlock[] {
  const existing = new Set<string>();
  for (const block of blocks) {
    if (block.type === "text") headingsOf(block.doc, existing);
  }
  return sections
    .filter((section) => section.title.trim() !== "" && !existing.has(normalize(section.title)))
    .map(sectionBlock);
}
