import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { AudioLines, Link2, MessageSquarePlus, Music2, SquarePlus } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import { CardPicker, documentKeys, typeLabel, useStartFromTemplate } from "@/features/cards";
import { type CardType, type CueKind, commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";

/** The passage the menu acts on, kept while a picker is open (the editor loses the focus). */
type Passage = { from: number; to: number; text: string; rect: DOMRect };

/**
 * The menu over a selected passage (docs/features/08-quill.md): « Créer une
 * carte » (the passage becomes its name and a mention of it) and « Lier à une
 * carte » (the passage becomes a mention of the card chosen) and « Ajouter une
 * note » (a note anchored to the passage). In the Audio mode (M10), it offers
 * a sound instead: « Effet sonore » or « Ambiance » on the passage.
 */
export function SelectionMenu({
  editor,
  onAddNote,
  onAddSound,
}: {
  editor: Editor;
  /** Adds a note on the passage `from`–`to`. */
  onAddNote: (from: number, to: number) => void;
  /** The Audio mode: adds a sound of `kind` on the passage `from`–`to`. */
  onAddSound?: ((kind: CueKind, from: number, to: number) => void) | undefined;
}) {
  const { t } = useTranslation();
  const [passage, setPassage] = useState<Passage | null>(null);
  const [action, setAction] = useState<"create" | "link" | null>(null);

  const take = (next: "create" | "link") => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, " ").trim();
    if (text === "") return;
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    setPassage({
      from,
      to,
      text,
      rect: new DOMRect(
        start.left,
        start.top,
        Math.max(end.right - start.left, 1),
        end.bottom - start.top,
      ),
    });
    setAction(next);
  };
  const close = () => {
    setAction(null);
    setPassage(null);
  };
  /** The passage becomes a mention of `id`. */
  const mention = (id: string, label: string) => {
    if (!passage) return;
    editor
      .chain()
      .focus()
      .insertContentAt({ from: passage.from, to: passage.to }, [
        { type: "mention", attrs: { id, label } },
      ])
      .run();
    close();
  };

  return (
    <>
      <BubbleMenu
        editor={editor}
        shouldShow={({ state, from, to }) =>
          from !== to && state.doc.textBetween(from, to, " ").trim() !== "" && action === null
        }
        // Under the passage: above it is the sticky toolbar.
        options={{ placement: "bottom-start", offset: 6 }}
        className="glass z-50 flex items-center gap-1 rounded-lg p-1 shadow-lg"
      >
        {onAddSound ? (
          (["effect", "ambience"] as const).map((kind) => {
            const Icon = kind === "effect" ? Music2 : AudioLines;
            return (
              <Button
                key={kind}
                type="button"
                size="sm"
                variant="ghost"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  const { from, to } = editor.state.selection;
                  onAddSound(kind, from, to);
                }}
              >
                <Icon />
                {t(`quill.audio.add.${kind}`)}
              </Button>
            );
          })
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => take("create")}
            >
              <SquarePlus />
              {t("quill.selection.create")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => take("link")}
            >
              <Link2 />
              {t("quill.selection.link")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const { from, to } = editor.state.selection;
                onAddNote(from, to);
              }}
            >
              <MessageSquarePlus />
              {t("quill.selection.note")}
            </Button>
          </>
        )}
      </BubbleMenu>
      {passage &&
        action === "link" &&
        createPortal(
          <CardPicker
            open
            onOpenChange={(open) => !open && close()}
            label={t("quill.selection.linkLabel", { text: passage.text })}
            allowedTypeIds={[]}
            onPick={(cardId) => mention(cardId, passage.text)}
          >
            <span
              aria-hidden
              className="pointer-events-none fixed"
              style={{
                left: passage.rect.left,
                top: passage.rect.top,
                width: passage.rect.width,
                height: passage.rect.height,
              }}
            />
          </CardPicker>,
          document.body,
        )}
      {passage && action === "create" && (
        <CreateCardPopover passage={passage} onClose={close} onCreated={mention} />
      )}
    </>
  );
}

/** The card types to create a card named after the passage. */
function CreateCardPopover({
  passage,
  onClose,
  onCreated,
}: {
  passage: Passage;
  onClose: () => void;
  onCreated: (id: string, label: string) => void;
}) {
  const { t } = useTranslation();
  const types = useCardTypes();
  const queryClient = useQueryClient();
  const startFromTemplate = useStartFromTemplate();
  const create = useMutation({
    mutationFn: async (type: CardType) => {
      const card = await unwrap(commands.createCard(type.id, passage.text));
      // Like any new card, it starts with its type's template; a failure
      // there still leaves the card (and its mention).
      await startFromTemplate(card.id, type, types.data ?? []).catch((error: unknown) =>
        console.warn("Cannot apply the template to the new card", error),
      );
      return card;
    },
    onSuccess: (card) => {
      void queryClient.invalidateQueries({ queryKey: documentKeys.all() });
      onCreated(card.id, card.title);
    },
  });
  const all = types.data ?? [];
  return (
    <Popover open onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor asChild>
        <span
          aria-hidden
          className="pointer-events-none fixed"
          style={{
            left: passage.rect.left,
            top: passage.rect.top,
            width: passage.rect.width,
            height: passage.rect.height,
          }}
        />
      </PopoverAnchor>
      <PopoverContent align="start" className="flex w-64 flex-col gap-1 p-2">
        <p className="px-1 pb-1 text-xs text-muted-foreground">
          {t("quill.selection.createTitle", { text: passage.text })}
        </p>
        <ul
          aria-label={t("quill.selection.types")}
          className="flex max-h-72 flex-col overflow-y-auto"
        >
          {all.map((type) => {
            const Icon = typeIcon(type.icon);
            return (
              <li key={type.id}>
                <button
                  type="button"
                  disabled={create.isPending}
                  onClick={() => create.mutate(type)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
                >
                  <Icon aria-hidden className="size-4" style={{ color: typeColor(type.color) }} />
                  {typeLabel(type, all)}
                </button>
              </li>
            );
          })}
        </ul>
        {create.error && <AppErrorMessage error={create.error} />}
      </PopoverContent>
    </Popover>
  );
}
