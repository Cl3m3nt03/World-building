import Mention from "@tiptap/extension-mention";
import { generateHTML } from "@tiptap/html";
import type { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

/** How a mentioned card shows in the site: its current name, and its page if it has one. */
export type MentionTarget = (id: string) => { name: string; href: string | null } | null;

/**
 * The HTML of a text block, from the same schema as the editor (ADR 0008):
 * a mention of a card with a page is a link to it, any other its name only.
 */
export function textHtml(doc: JSONContent, target: MentionTarget): string {
  const mention = Mention.extend({
    renderHTML({ node }) {
      const id = String(node.attrs.id ?? "");
      const found = target(id);
      const name = found?.name ?? String(node.attrs.label ?? "");
      return found?.href
        ? ["a", { class: "mention", href: found.href }, name]
        : ["span", { class: found ? "mention-plain" : "mention-dead" }, name];
    },
  });
  return generateHTML(doc, [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), mention]);
}

/** The words of a text block, for the search index (mentions by their name). */
export function plainText(doc: JSONContent, name: (id: string) => string | null): string {
  const parts: string[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === "text" && node.text) parts.push(node.text);
    else if (node.type === "mention") {
      parts.push(name(String(node.attrs?.id ?? "")) ?? String(node.attrs?.label ?? ""));
    }
    for (const child of node.content ?? []) walk(child);
    if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem") {
      parts.push(" ");
    }
  };
  walk(doc);
  return parts.join("").replace(/\s+/g, " ").trim();
}
