import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  ImagePlus,
  Italic,
  PanelTop,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FONT_NAMES, WIKI_FONTS, type WikiFontKey } from "@/features/wiki";

/** Font sizes offered, in px. */
export const FONT_SIZES = [14, 16, 18, 20, 24, 28, 32] as const;

const FONT_KEYS = Object.keys(WIKI_FONTS) as WikiFontKey[];

/** The value of "no font set": the text's own. */
const DEFAULT = "default";

type Props = {
  editor: Editor;
  onImage: () => void;
  onHeader: () => void;
};

/**
 * The toolbar over a chapter's text: font and size of the selection, bold,
 * italic, strike, quote, an image of the media library, the chapter's header
 * image, undo and redo.
 */
export function EditorToolbar({ editor, onImage, onHeader }: Props) {
  const { t } = useTranslation();
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      font: (current.getAttributes("textStyle").fontFamily as string | undefined) ?? DEFAULT,
      size: (current.getAttributes("textStyle").fontSize as string | undefined) ?? DEFAULT,
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      strike: current.isActive("strike"),
      quote: current.isActive("blockquote"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  const fontKey = FONT_KEYS.find((key) => WIKI_FONTS[key] === state.font) ?? DEFAULT;

  const toggle = (label: string, active: boolean, run: () => void, Icon: typeof Bold) => (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      className="aria-pressed:bg-secondary"
      onMouseDown={(event) => event.preventDefault()}
      onClick={run}
    >
      <Icon />
    </Button>
  );

  return (
    // A container: the labels of Image and Header show when there is room.
    <div className="@container">
      <div
        role="toolbar"
        aria-label={t("quill.toolbar.label")}
        className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1"
      >
        <Select
          value={fontKey}
          onValueChange={(key) => {
            const chain = editor.chain().focus();
            if (key === DEFAULT) chain.unsetFontFamily().run();
            else chain.setFontFamily(WIKI_FONTS[key as WikiFontKey]).run();
          }}
        >
          <SelectTrigger size="sm" aria-label={t("quill.toolbar.font")} className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT}>{t("quill.toolbar.defaultFont")}</SelectItem>
            {FONT_KEYS.map((key) => (
              <SelectItem key={key} value={key} style={{ fontFamily: WIKI_FONTS[key] }}>
                {FONT_NAMES[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={state.size}
          onValueChange={(size) => {
            const chain = editor.chain().focus();
            if (size === DEFAULT) chain.unsetFontSize().run();
            else chain.setFontSize(size).run();
          }}
        >
          <SelectTrigger size="sm" aria-label={t("quill.toolbar.size")} className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT}>{t("quill.toolbar.defaultSize")}</SelectItem>
            {FONT_SIZES.map((size) => (
              <SelectItem key={size} value={`${size}px`}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        {toggle(
          t("quill.toolbar.bold"),
          state.bold,
          () => editor.chain().focus().toggleBold().run(),
          Bold,
        )}
        {toggle(
          t("quill.toolbar.italic"),
          state.italic,
          () => editor.chain().focus().toggleItalic().run(),
          Italic,
        )}
        {toggle(
          t("quill.toolbar.strike"),
          state.strike,
          () => editor.chain().focus().toggleStrike().run(),
          Strikethrough,
        )}
        {toggle(
          t("quill.toolbar.quote"),
          state.quote,
          () => editor.chain().focus().toggleBlockquote().run(),
          Quote,
        )}
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="sm" onClick={onImage}>
          <ImagePlus />
          <span className="sr-only @xl:not-sr-only">{t("quill.toolbar.image")}</span>
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onHeader}>
          <PanelTop />
          <span className="sr-only @xl:not-sr-only">{t("quill.toolbar.header")}</span>
        </Button>
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("quill.toolbar.undo")}
          disabled={!state.canUndo}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("quill.toolbar.redo")}
          disabled={!state.canRedo}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 />
        </Button>
      </div>
    </div>
  );
}
