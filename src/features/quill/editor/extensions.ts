import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { type Editor, Extension, mergeAttributes, type Range } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Suggestion from "@tiptap/suggestion";
import { assetUrl } from "@/lib/assets";
import type { ListStore } from "./listStore";

/** What "/" offers at the start of a line. */
export type SlashCommand = "heading1" | "heading2" | "heading3" | "divider" | "quote" | "image";

export const SLASH_COMMANDS: SlashCommand[] = [
  "heading1",
  "heading2",
  "heading3",
  "divider",
  "quote",
  "image",
];

/**
 * An image of the media library in the text. Only its asset id is kept in
 * the draft: the address is made when shown, so the text stays portable.
 */
export const AssetImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: { default: null, rendered: false },
      assetId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-asset-id"),
        renderHTML: (attributes) =>
          attributes.assetId ? { "data-asset-id": attributes.assetId } : {},
      },
    };
  },
  renderHTML({ HTMLAttributes, node }) {
    const id = typeof node.attrs.assetId === "string" ? node.attrs.assetId : null;
    return ["img", mergeAttributes(HTMLAttributes, id ? { src: assetUrl(id) } : {})];
  },
});

/** Runs a "/" command on the range of the typed "/…". */
export function runSlashCommand(
  editor: Editor,
  range: Range,
  command: SlashCommand,
  pickImage: () => void,
) {
  const chain = editor.chain().focus().deleteRange(range);
  switch (command) {
    case "heading1":
      chain.setNode("heading", { level: 1 }).run();
      break;
    case "heading2":
      chain.setNode("heading", { level: 2 }).run();
      break;
    case "heading3":
      chain.setNode("heading", { level: 3 }).run();
      break;
    case "divider":
      chain.setHorizontalRule().run();
      break;
    case "quote":
      chain.toggleBlockquote().run();
      break;
    case "image":
      chain.run();
      pickImage();
      break;
  }
}

/**
 * "/" at the start of a line: a list of commands (titles, divider, quote,
 * image), filtered as one types, shown by `SlashMenu` through `store`.
 */
function slashCommands(
  store: ListStore<SlashCommand>,
  label: (command: SlashCommand) => string,
  pickImage: () => void,
) {
  return Extension.create({
    name: "quillSlash",
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashCommand>({
          editor: this.editor,
          char: "/",
          startOfLine: true,
          items: ({ query }) => {
            const wanted = query.toLowerCase();
            return SLASH_COMMANDS.filter((command) =>
              label(command).toLowerCase().includes(wanted),
            );
          },
          command: ({ editor, range, props }) => runSlashCommand(editor, range, props, pickImage),
          render: () => {
            const show = (props: {
              items: SlashCommand[];
              clientRect?: (() => DOMRect | null) | null;
              command: (command: SlashCommand) => void;
            }) => store.show(props.items, props.clientRect?.() ?? null, props.command);
            return {
              onStart: show,
              onUpdate: show,
              onKeyDown: ({ event }) => {
                if (event.key === "ArrowDown") {
                  store.move(1);
                  return true;
                }
                if (event.key === "ArrowUp") {
                  store.move(-1);
                  return true;
                }
                if (event.key === "Enter" || event.key === "Tab") return store.pick();
                if (event.key === "Escape") {
                  store.close();
                  return true;
                }
                return false;
              },
              onExit: () => store.close(),
            };
          },
        }),
      ];
    },
  });
}

type Options = {
  placeholder: string;
  slash: ListStore<SlashCommand>;
  slashLabel: (command: SlashCommand) => string;
  pickImage: () => void;
};

/**
 * The extensions of a chapter's text (M9): the cards' text schema (titles,
 * lists, quotes, dividers), plus fonts and sizes, images of the media library
 * and the "/" commands.
 */
export function quillExtensions({ placeholder, slash, slashLabel, pickImage }: Options) {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    TextStyle,
    FontFamily,
    FontSize,
    AssetImage,
    Placeholder.configure({ placeholder }),
    slashCommands(slash, slashLabel, pickImage),
  ];
}
