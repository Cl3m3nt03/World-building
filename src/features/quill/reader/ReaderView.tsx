import { useQueries } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { AssetImage } from "@/features/media";
import { type Chapter, commands, type ReaderSettings, type StoryOutline } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { BookCover } from "../components/BookCover";
import { quillKeys } from "../hooks/useQuill";
import { BookText } from "./BookText";
import { pageColors, readerFont, TEXT_SIZES } from "./settings";

/** The devices a book is previewed on. */
export type Template = "web" | "mobile" | "ereader";

export const TEMPLATES: Template[] = ["web", "mobile", "ereader"];

function parse(content: string | undefined): JSONContent | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as JSONContent;
  } catch {
    return null;
  }
}

/** The current drafts' texts of a story's chapters, by chapter id. */
export function useChapterTexts(chapters: Chapter[]): Map<string, JSONContent | null> {
  const drafts = useQueries({
    queries: chapters.map((chapter) => ({
      queryKey: quillKeys.draft(chapter.currentDraftId),
      queryFn: () => unwrap(commands.getDraft(chapter.currentDraftId)),
    })),
  });
  return new Map(
    chapters.map((chapter, index) => [chapter.id, parse(drafts[index]?.data?.content)]),
  );
}

/** A chapter's opening: its header image and title, as the layout says. */
function ChapterOpening({ chapter, settings }: { chapter: Chapter; settings: ReaderSettings }) {
  const image =
    settings.chapterLayout === "noImage" || !chapter.headerAssetId ? null : chapter.headerAssetId;
  const title = <h1 className="reader-chapter-title">{chapter.title}</h1>;
  if (image && settings.chapterLayout === "titleOver") {
    return (
      <header className="reader-opening relative">
        <AssetImage assetId={image} alt="" className="aspect-[3/1] w-full rounded object-cover" />
        <div className="reader-over absolute inset-0 flex items-center justify-center rounded">
          {title}
        </div>
      </header>
    );
  }
  return (
    <header className="reader-opening">
      {image && (
        <AssetImage assetId={image} alt="" className="aspect-[3/1] w-full rounded object-cover" />
      )}
      {title}
    </header>
  );
}

/** The book's pages: its cover, then each chapter, as the settings say. */
function Book({
  outline,
  texts,
  settings,
}: {
  outline: StoryOutline;
  texts: Map<string, JSONContent | null>;
  settings: ReaderSettings;
}) {
  return (
    <>
      <section className="reader-cover">
        <BookCover
          large
          title={outline.story.title}
          bookStyle={outline.story.bookStyle}
          cover={outline.story.cover}
          className="mx-auto w-3/5 max-w-64"
        />
      </section>
      {outline.chapters.map((chapter) => {
        const doc = texts.get(chapter.id);
        return (
          <section key={chapter.id} className="reader-chapter" data-chapter={chapter.id}>
            <ChapterOpening chapter={chapter} settings={settings} />
            {doc && <BookText doc={doc} />}
          </section>
        );
      })}
    </>
  );
}

/**
 * Pages turned one by one: the book flows in columns as wide as the page,
 * and one column shows at a time.
 */
function Paged({ children, label }: { children: ReactNode; label: string }) {
  const { t } = useTranslation();
  const frame = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(1);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = () => {
      const next = element.clientWidth;
      setWidth(next);
      const pages = next > 0 ? Math.max(1, Math.round((flow.current?.scrollWidth ?? 0) / next)) : 1;
      setCount(pages);
      setPage((current) => Math.min(current, pages - 1));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (flow.current) observer.observe(flow.current);
    return () => observer.disconnect();
  }, []);
  const go = (next: number) => setPage(Math.min(Math.max(next, 0), count - 1));
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "PageDown") go(page + 1);
    else if (event.key === "ArrowLeft" || event.key === "PageUp") go(page - 1);
    else return;
    event.preventDefault();
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={frame}
        role="document"
        aria-label={label}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: pages turn with the arrow keys
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="reader-page relative min-h-0 flex-1 overflow-hidden outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div
          ref={flow}
          className="h-full"
          style={{
            columnWidth: width > 0 ? `${width}px` : undefined,
            columnGap: 0,
            columnFill: "auto",
            transform: `translateX(-${page * width}px)`,
          }}
        >
          {children}
        </div>
      </div>
      <div className="reader-turns flex shrink-0 items-center justify-center gap-3 py-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("quill.reader.previousPage")}
          disabled={page === 0}
          onClick={() => go(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="text-xs tabular-nums" aria-live="polite">
          {t("quill.reader.page", { page: page + 1, count })}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("quill.reader.nextPage")}
          disabled={page >= count - 1}
          onClick={() => go(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

/** The frame of each device around the page. */
const FRAMES: Record<Template, string> = {
  web: "h-full w-full max-w-4xl rounded-lg border border-border shadow-lg",
  mobile:
    "aspect-[9/19] h-full max-h-[46rem] rounded-[2.5rem] border-[10px] border-[var(--bz-device)] shadow-xl",
  ereader:
    "aspect-[3/4] h-full max-h-[44rem] rounded-2xl border-[18px] border-b-[44px] border-[var(--bz-device)] shadow-xl",
};

type Props = {
  outline: StoryOutline;
  settings: ReaderSettings;
  template: Template;
  /** The chapter to show first (scrolled to, in scroll mode). */
  chapterId?: string | undefined;
};

/**
 * The reading preview (docs/features/08-quill.md, M10): the story as a
 * reader would see it, on a browser, a phone or an e-reader, with the
 * story's reading settings (page theme, background, font, size, chapter
 * layout, scroll or pages).
 */
export function ReaderView({ outline, settings, template, chapterId }: Props) {
  const { t, i18n } = useTranslation();
  const texts = useChapterTexts(outline.chapters);
  const scroller = useRef<HTMLDivElement>(null);
  const colors = pageColors(settings);
  const style = {
    "--reader-page": colors.page,
    "--reader-text": colors.text,
    "--reader-muted": colors.muted,
    "--reader-font": readerFont(settings.font),
    "--reader-size": `${TEXT_SIZES[settings.textSize] * (template === "web" ? 1 : 0.9)}px`,
  } as CSSProperties;
  const label = t("quill.reader.label", { title: outline.story.title });
  const loaded = outline.chapters.every((chapter) => texts.get(chapter.id) !== undefined);

  // In scroll mode, the chapter open in the writing space comes into view.
  useEffect(() => {
    if (settings.mode !== "scroll" || !chapterId || !loaded) return;
    const target = scroller.current?.querySelector(`[data-chapter="${chapterId}"]`);
    if (target instanceof HTMLElement && scroller.current) {
      scroller.current.scrollTop = target.offsetTop - 16;
    }
  }, [settings.mode, chapterId, loaded]);

  const book = <Book outline={outline} texts={texts} settings={settings} />;
  return (
    <div className="flex h-full min-h-0 items-center justify-center p-4">
      <div
        data-reader-template={template}
        // Hyphenation needs the language of the text: the app's, by default.
        lang={i18n.language}
        className={cn("reader overflow-hidden", FRAMES[template])}
        style={style}
      >
        {settings.mode === "pages" ? (
          <Paged label={label}>{book}</Paged>
        ) : (
          <div
            ref={scroller}
            role="document"
            aria-label={label}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: the page scrolls with the keys
            tabIndex={0}
            className="reader-page h-full overflow-y-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {book}
          </div>
        )}
      </div>
    </div>
  );
}
