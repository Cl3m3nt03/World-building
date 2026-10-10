import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { PanelRightClose, PanelRightOpen, Star, X } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { useCardTypes } from "@/features/card-types";
import { DEFAULT_PREFERENCES, MentionContext, useCardList } from "@/features/cards";
import { AssetImage, ImagePickerDialog } from "@/features/media";
import { useCurrentWorld } from "@/features/world";
import { type Chapter, commands, type StoryNote } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { CueList } from "../audio/CueList";
import { CompareView } from "../drafts/CompareView";
import { draftRoute } from "../drafts/routes";
import { ChapterEditor } from "../editor/ChapterEditor";
import { useChapterChange, useStoryOutline } from "../hooks/useQuill";
import type { WritingStyle } from "../panel/layout";
import { PanelContext, usePanelLayout } from "../panel/PanelContext";
import { WorldPanel, type WorldPanelHandle } from "../panel/WorldPanel";
import { PlayView } from "../play/PlayView";
import { ReaderStyle } from "../reader/ReaderStyle";
import { ReaderView, type Template } from "../reader/ReaderView";
import { useReaderSettings } from "../reader/settings";
import { FocusTimer } from "../timer/FocusTimer";
import type { Session } from "../timer/session";
import { ChapterList } from "./ChapterList";
import { type Mode, ModeBar, readMode } from "./ModeBar";

/**
 * The writing space (docs/features/08-quill.md): the story's chapters on the
 * left, with the open chapter's drafts; in the middle, the chapter (header
 * image, title, text of the draft shown) or two of its drafts compared; and
 * the words of the chapter and of the story. The world panel comes on the
 * right (9.7).
 */
export function WritingSpace() {
  const { t } = useTranslation();
  const params = useParams({ strict: false });
  const storyId = params.storyId ?? "";
  const chapterId = params.chapterId ?? "";
  const outline = useStoryOutline(storyId);
  const search = useSearch({ strict: false }) as { mode?: unknown };
  const mode = readMode(search.mode);
  const [template, setTemplate] = useState<Template>("web");
  const reader = useReaderSettings(storyId);
  const panel = useRef<WorldPanelHandle>(null);
  const panelLayout = usePanelLayout(storyId);
  const [showPanel, setShowPanel] = useState(true);
  // The focus timer's session goes on from one chapter to another.
  const [session, setSession] = useState<Session | null>(null);
  const openCard = (cardId: string) => {
    setShowPanel(true);
    // The panel may have just been shown: one frame for it to be there.
    requestAnimationFrame(() => panel.current?.openCard(cardId));
  };
  const [focusNote, setFocusNote] = useState<{ id: string; key: number } | null>(null);
  const [focusCue, setFocusCue] = useState<{ id: string; key: number } | null>(null);
  const navigate = useNavigate();
  const cards = useCardList(false);
  const trashed = useCardList(true);
  const types = useCardTypes();
  const { data: world } = useCurrentWorld();

  const setMode = (next: Mode) => {
    void navigate({
      to: ".",
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        mode: next === "write" ? undefined : next,
      }),
    } as never);
  };

  const openNote = (note: StoryNote) => {
    const target = outline.data?.chapters.find((item) => item.id === note.chapterId);
    if (!target || !params.worldId) return;
    void navigate(draftRoute(params.worldId, target, note.draftId));
    setFocusNote({ id: note.id, key: Date.now() });
  };

  if (outline.error) {
    return (
      <div className="p-6">
        <AppErrorMessage error={outline.error} />
      </div>
    );
  }
  if (!outline.data) return null;
  const chapter = outline.data.chapters.find((candidate) => candidate.id === chapterId);
  // The draft shown: the one asked for if it is still there, else the current one.
  const draftId =
    chapter?.drafts.find((draft) => draft.id === params.draftId)?.id ??
    chapter?.currentDraftId ??
    "";
  const compared =
    params.leftId && params.rightId ? { left: params.leftId, right: params.rightId } : null;

  const publishing = mode === "publish";
  const center = publishing ? (
    <ReaderView
      outline={outline.data}
      settings={reader.settings}
      template={template}
      chapterId={chapterId}
    />
  ) : mode === "play" && chapter ? (
    <PlayView key={draftId} chapter={chapter} draftId={draftId} />
  ) : chapter && compared ? (
    <CompareView chapter={chapter} leftId={compared.left} rightId={compared.right} />
  ) : chapter ? (
    <MentionContext.Provider
      value={{
        cards: cards.data ?? [],
        trashed: trashed.data ?? [],
        types: types.data ?? [],
        preferences: world?.preferences ?? DEFAULT_PREFERENCES,
        open: openCard,
      }}
    >
      <ChapterView
        key={chapter.id}
        chapter={chapter}
        draftId={draftId}
        storyWords={outline.data.story.wordCount}
        onOpenCard={openCard}
        focusNote={focusNote}
        audio={mode === "audio"}
        focusCue={focusCue}
        writingStyle={panelLayout.layout?.style ?? "world"}
        panelShown={showPanel}
        onTogglePanel={() => setShowPanel((shown) => !shown)}
        session={session}
        setSession={setSession}
      />
    </MentionContext.Provider>
  ) : null;

  return (
    <div
      className={cn(
        "glass grid h-full gap-4 rounded-lg p-4",
        publishing ||
          (mode === "audio" && chapter && !compared) ||
          (showPanel && panelLayout.layout)
          ? // The text keeps the larger part; the panel shares the room.
            "grid-cols-[13rem_minmax(0,3fr)_minmax(18rem,2fr)] xl:grid-cols-[15rem_minmax(0,3fr)_minmax(20rem,2fr)]"
          : "grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]",
      )}
    >
      <ChapterList
        outline={outline.data}
        currentId={chapterId}
        openDraftId={compared?.right ?? draftId}
        onOpenNote={openNote}
      />
      <div className="flex min-h-0 min-w-0 flex-col gap-2">
        {/* A grid: the chapter, the comparison or the preview fills the height. */}
        <div className="grid min-h-0 flex-1">{center}</div>
        <div className="flex shrink-0 justify-center">
          <ModeBar
            mode={mode}
            modes={["write", "audio", "play", "publish"]}
            onMode={setMode}
            template={template}
            onTemplate={setTemplate}
          />
        </div>
      </div>
      {mode === "audio" && chapter && !compared ? (
        <aside
          aria-label={t("quill.audio.panel")}
          className="scrollbar-thin flex min-h-0 flex-col overflow-y-auto border-l border-border pl-4"
        >
          <h2 className="pt-4 pl-4 font-heading text-lg font-bold">{t("quill.audio.panel")}</h2>
          <p className="px-4 pt-1 text-xs text-muted-foreground">{t("quill.audio.hint")}</p>
          <CueList draftId={draftId} onOpen={(id) => setFocusCue({ id, key: Date.now() })} />
        </aside>
      ) : publishing ? (
        <aside
          aria-label={t("quill.reader.panel")}
          className="scrollbar-thin flex min-h-0 flex-col overflow-y-auto border-l border-border pl-4"
        >
          <h2 className="pt-4 pl-4 font-heading text-lg font-bold">{t("quill.reader.style")}</h2>
          <ReaderStyle settings={reader.settings} onChange={reader.change} error={reader.error} />
        </aside>
      ) : (
        showPanel &&
        panelLayout.layout && (
          <PanelContext.Provider
            value={{
              storyId,
              chapter: chapter ?? null,
              layout: panelLayout.layout,
              update: panelLayout.update,
              openCard,
              openNote,
            }}
          >
            <WorldPanel key={storyId} ref={panel} />
          </PanelContext.Provider>
        )
      )}
    </div>
  );
}

function ChapterView({
  chapter,
  draftId,
  storyWords,
  onOpenCard,
  focusNote,
  audio,
  focusCue,
  writingStyle,
  panelShown,
  onTogglePanel,
  session,
  setSession,
}: {
  chapter: Chapter;
  draftId: string;
  storyWords: number;
  onOpenCard: (cardId: string) => void;
  focusNote: { id: string; key: number } | null;
  audio: boolean;
  focusCue: { id: string; key: number } | null;
  writingStyle: WritingStyle;
  panelShown: boolean;
  onTogglePanel: () => void;
  session: Session | null;
  setSession: Dispatch<SetStateAction<Session | null>>;
}) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const navigate = useNavigate();
  const draft = chapter.drafts.find((candidate) => candidate.id === draftId);
  const isCurrent = draftId === chapter.currentDraftId;
  const [words, setWords] = useState(draft?.wordCount ?? 0);
  const [picking, setPicking] = useState(false);
  const header = useChapterChange((assetId: string | null) =>
    unwrap(commands.setChapterHeader(chapter.id, assetId)),
  );
  const makeCurrent = useChapterChange(() => unwrap(commands.setCurrentDraft(draftId)));
  // The story's words: the others as saved, this one as typed. Only the
  // current draft counts for the story.
  const total = isCurrent ? storyWords - chapter.wordCount + words : storyWords;

  return (
    <article
      aria-label={chapter.title}
      // The writing mode's look (the panel's Style tab): the world's, or light, or dark.
      data-quill-scheme={writingStyle === "world" ? undefined : writingStyle}
      className="relative flex min-h-0 flex-col rounded-lg bg-background text-foreground"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t(panelShown ? "quill.panel.hide" : "quill.panel.show")}
        aria-pressed={panelShown}
        className="absolute top-0 right-0 z-20"
        onClick={onTogglePanel}
      >
        {panelShown ? <PanelRightClose /> : <PanelRightOpen />}
      </Button>
      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto pr-2">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {chapter.headerAssetId && (
            <div className="group relative">
              <AssetImage
                assetId={chapter.headerAssetId}
                alt={t("quill.header.alt")}
                className="aspect-[4/1] w-full rounded-lg object-cover"
              />
              <Button
                variant="secondary"
                size="icon-xs"
                aria-label={t("quill.header.remove")}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => header.mutate(null)}
              >
                <X />
              </Button>
            </div>
          )}
          <ChapterTitle chapter={chapter} />
          {header.error && <AppErrorMessage error={header.error} />}
          {!isCurrent && draft && (
            <div
              role="note"
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm"
            >
              <span className="flex-1">{t("quill.drafts.notCurrent", { name: draft.name })}</span>
              <Button
                size="sm"
                variant="secondary"
                disabled={makeCurrent.isPending}
                onClick={() =>
                  makeCurrent.mutate(undefined, {
                    onSuccess: () =>
                      void navigate({
                        to: "/world/$worldId/quill/story/$storyId/chapter/$chapterId",
                        params: { worldId, storyId: chapter.storyId, chapterId: chapter.id },
                      }),
                  })
                }
              >
                <Star />
                {t("quill.drafts.makeCurrent")}
              </Button>
            </div>
          )}
          {makeCurrent.error && <AppErrorMessage error={makeCurrent.error} />}
          <ChapterEditor
            key={draftId}
            storyId={chapter.storyId}
            draftId={draftId}
            onWords={setWords}
            onHeader={() => setPicking(true)}
            onOpenCard={onOpenCard}
            focusNote={focusNote}
            audio={audio}
            focusCue={focusCue}
          />
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-center gap-4 border-t border-border pt-2 text-xs text-muted-foreground">
        <p role="status" aria-live="off">
          {t(isCurrent ? "quill.wordCounts" : "quill.draftWordCounts", {
            chapter: words,
            story: total,
          })}
        </p>
        <FocusTimer words={total} session={session} setSession={setSession} />
      </div>
      <ImagePickerDialog
        open={picking}
        onOpenChange={setPicking}
        title={t("quill.toolbar.header")}
        selectedId={chapter.headerAssetId}
        onPick={(assetId) => header.mutate(assetId)}
      />
    </article>
  );
}

/** The chapter's title, written in place over its text. */
function ChapterTitle({ chapter }: { chapter: Chapter }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(chapter.title);
  const rename = useChapterChange((value: string) =>
    unwrap(commands.renameChapter(chapter.id, value)),
  );
  useEffect(() => setTitle(chapter.title), [chapter.title]);
  const commit = () => {
    const value = title.trim();
    if (value === "") setTitle(chapter.title);
    else if (value !== chapter.title) rename.mutate(value);
  };
  return (
    <div className="flex flex-col gap-1">
      <input
        aria-label={t("quill.chapterName")}
        value={title}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setTitle(chapter.title);
            event.currentTarget.blur();
          }
        }}
        className="w-full rounded-md border border-transparent bg-transparent px-2 text-center font-heading text-3xl font-bold outline-none hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {rename.error && <AppErrorMessage error={rename.error} />}
    </div>
  );
}
