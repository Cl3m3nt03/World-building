import type { JSONContent } from "@tiptap/react";
import type { CSSProperties, ReactNode } from "react";
import { AssetImage } from "@/features/media";

/**
 * A chapter's text as a reader sees it, from its TipTap JSON: titles,
 * paragraphs, quotes, lists, dividers and images, with bold, italic, strike,
 * underline, code, fonts and sizes. A mention shows its name; notes and
 * sounds do not show. Each top-level block is marked `data-block` (its
 * index), for the reading with sound to follow the text.
 */
export function BookText({ doc }: { doc: JSONContent }) {
  return <>{(doc.content ?? []).map((node, index) => block(node, `${index}`, index))}</>;
}

function children(node: JSONContent, key: string): ReactNode[] {
  return (node.content ?? []).map((child, index) => inline(child, `${key}.${index}`));
}

function block(node: JSONContent, key: string, top?: number): ReactNode {
  const data = top === undefined ? {} : { "data-block": top };
  switch (node.type) {
    case "paragraph":
      return (
        <p key={key} {...data}>
          {children(node, key)}
        </p>
      );
    case "heading": {
      const level = Number(node.attrs?.level ?? 1);
      const Tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
      return (
        <Tag key={key} {...data}>
          {children(node, key)}
        </Tag>
      );
    }
    case "blockquote":
      return (
        <blockquote key={key} {...data}>
          {(node.content ?? []).map((child, index) => block(child, `${key}.${index}`))}
        </blockquote>
      );
    case "bulletList":
    case "orderedList": {
      const Tag = node.type === "bulletList" ? "ul" : "ol";
      return (
        <Tag key={key} {...data}>
          {(node.content ?? []).map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a text's blocks have no id; the text is shown, not edited
            <li key={`${key}.${index}`}>
              {(item.content ?? []).map((child, at) => block(child, `${key}.${index}.${at}`))}
            </li>
          ))}
        </Tag>
      );
    }
    case "codeBlock":
      return (
        <pre key={key} {...data}>
          <code>{children(node, key)}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr key={key} {...data} />;
    case "image": {
      const assetId = typeof node.attrs?.assetId === "string" ? node.attrs.assetId : null;
      if (!assetId) return null;
      return (
        <figure key={key} {...data}>
          <AssetImage assetId={assetId} alt={String(node.attrs?.alt ?? "")} />
        </figure>
      );
    }
    default:
      return node.content ? (
        <div key={key} {...data}>
          {children(node, key)}
        </div>
      ) : null;
  }
}

function inline(node: JSONContent, key: string): ReactNode {
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type === "mention") {
    return <span key={key}>{String(node.attrs?.label ?? "")}</span>;
  }
  if (node.type !== "text") return block(node, key);
  let content: ReactNode = node.text ?? "";
  const style: CSSProperties = {};
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        content = <strong>{content}</strong>;
        break;
      case "italic":
        content = <em>{content}</em>;
        break;
      case "strike":
        content = <s>{content}</s>;
        break;
      case "underline":
        content = <u>{content}</u>;
        break;
      case "code":
        content = <code>{content}</code>;
        break;
      case "textStyle":
        if (typeof mark.attrs?.fontFamily === "string") style.fontFamily = mark.attrs.fontFamily;
        if (typeof mark.attrs?.fontSize === "string") style.fontSize = mark.attrs.fontSize;
        break;
    }
  }
  return (
    <span key={key} style={Object.keys(style).length > 0 ? style : undefined}>
      {content}
    </span>
  );
}

/** The words of a chapter's text (mentions by their name), for the reading pace. */
export function blockTexts(doc: JSONContent): string[] {
  const text = (node: JSONContent): string => {
    if (node.type === "text") return node.text ?? "";
    if (node.type === "mention") return String(node.attrs?.label ?? "");
    return (node.content ?? []).map(text).join(" ");
  };
  return (doc.content ?? []).map(text);
}
