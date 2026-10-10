import { useQuery } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { type Chapter, commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { useSoundNames } from "../audio/CueMargin";
import { cueSpans } from "../audio/cueMark";
import { useDraftCues } from "../audio/useCues";
import { quillKeys } from "../hooks/useQuill";
import { BookText, blockTexts } from "../reader/BookText";
import { pageColors, readerFont, TEXT_SIZES, useReaderSettings } from "../reader/settings";
import { SoundEngine } from "./engine";
import { arrive, lineDuration, placeCues, wordsOf } from "./schedule";

/** The sounds played, kept for the end-to-end checks (`VITE_E2E=1` builds only). */
function trace(event: string) {
  if (import.meta.env.VITE_E2E === "1") {
    const page = window as Window & { __bzPlayLog?: string[] };
    page.__bzPlayLog = [...(page.__bzPlayLog ?? []), event];
  }
}

type Props = { chapter: Chapter; draftId: string };

/**
 * The reading with sound (« Lecture », docs/features/08-quill.md, M10): the
 * chapter as a reader sees it, the line being read set apart, going on at
 * the story's pace. Effects play when their line comes, ambiences are heard
 * all along their section. Space plays or pauses, the arrows go back or on,
 * a click on a line goes there.
 */
export function PlayView({ chapter, draftId }: Props) {
  const { t, i18n } = useTranslation();
  const speedId = useId();
  const volumeId = useId();
  const draft = useQuery({
    queryKey: quillKeys.draft(draftId),
    queryFn: () => unwrap(commands.getDraft(draftId)),
  });
  const cues = useDraftCues(draftId);
  const names = useSoundNames();
  const reader = useReaderSettings(chapter.storyId);
  const doc = useMemo<JSONContent | null>(() => {
    try {
      return draft.data ? (JSON.parse(draft.data.content) as JSONContent) : null;
    } catch {
      return null;
    }
  }, [draft.data]);
  const lines = useMemo(() => (doc ? blockTexts(doc) : []), [doc]);
  const placed = useMemo(
    () => (doc ? placeCues(cues.data ?? [], cueSpans(doc)) : []),
    [doc, cues.data],
  );
  const missing = (cues.data ?? []).filter(
    (cue) => !cue.assetId || (names.size > 0 && !names.has(cue.assetId)),
  ).length;

  const [line, setLine] = useState(0);
  const [running, setRunning] = useState(false);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const engine = useRef<SoundEngine | null>(null);
  // The line whose sounds were last given: going on after a pause does not
  // play its effects again.
  const sounded = useRef<number | null>(null);
  const page = useRef<HTMLDivElement>(null);
  const sound = () => {
    engine.current ??= new SoundEngine();
    return engine.current;
  };

  // The engine lives with the view; leaving it stops every sound.
  useEffect(
    () => () => {
      engine.current?.close();
      engine.current = null;
    },
    [],
  );
  // The sounds read ahead, to start on time.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sound() reads a ref only
  useEffect(() => {
    if (placed.length > 0) sound().preload(placed.flatMap((item) => item.cue.assetId ?? []));
  }, [placed]);
  useEffect(() => {
    engine.current?.setVolume(volume, muted);
  }, [volume, muted]);

  /** The sound of arriving on `next` (effects once, ambiences of its section). */
  const reach = (next: number) => {
    sounded.current = next;
    const engineNow = sound();
    const change = arrive(next, placed, engineNow.playing());
    for (const id of change.stop) {
      engineNow.stopAmbience(id);
      trace(`stop:${id}`);
    }
    for (const item of change.start) {
      if (!item.cue.assetId) continue;
      void engineNow.startAmbience(item.cue.id, item.cue.assetId, item.cue.volume, item.cue.looped);
      trace(`ambience:${item.cue.id}@${next}`);
    }
    for (const item of change.effects) {
      if (!item.cue.assetId) continue;
      void engineNow.effect(item.cue.assetId, item.cue.volume);
      trace(`effect:${item.cue.id}@${next}`);
    }
  };

  const go = (next: number, sounding = running) => {
    const target = Math.min(Math.max(next, 0), Math.max(lines.length - 1, 0));
    setLine(target);
    if (sounding) reach(target);
  };

  // Going on, line after line, at the story's pace.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the timer restarts on its line
  useEffect(() => {
    if (!running || lines.length === 0) return;
    const wait = lineDuration(wordsOf(lines[line] ?? ""), reader.settings.wordsPerMinute);
    const timer = window.setTimeout(() => {
      if (line >= lines.length - 1) {
        setRunning(false);
        engine.current?.stopAll();
        trace("end");
        return;
      }
      go(line + 1, true);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [running, line, lines, reader.settings.wordsPerMinute]);

  // The line being read is set apart and kept in view (again when the text comes).
  // biome-ignore lint/correctness/useExhaustiveDependencies: the text's blocks are drawn anew with doc
  useEffect(() => {
    const element = page.current;
    if (!element) return;
    for (const block of element.querySelectorAll("[data-reading]")) {
      block.removeAttribute("data-reading");
    }
    const current = element.querySelector(`[data-block="${line}"]`);
    if (!(current instanceof HTMLElement)) return;
    current.setAttribute("data-reading", "");
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    current.scrollIntoView?.({ block: "center", behavior: smooth ? "smooth" : "auto" });
  }, [line, doc]);

  const toggle = () => {
    if (running) {
      setRunning(false);
      void engine.current?.pause(true);
      return;
    }
    const restart = line >= lines.length - 1 && lines.length > 1;
    setRunning(true);
    void sound().pause(false);
    if (restart) {
      engine.current?.stopAll();
      go(0, true);
    } else if (sounded.current !== line) {
      // Moved while paused (or never started): the sounds of this line.
      reach(line);
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === " ") toggle();
    else if (event.key === "ArrowDown" || event.key === "ArrowRight") go(line + 1);
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") go(line - 1);
    else if (event.key === "Home") go(0);
    else return;
    event.preventDefault();
  };
  const onClick = (event: MouseEvent) => {
    const block = event.target instanceof Element ? event.target.closest("[data-block]") : null;
    const index = Number(block?.getAttribute("data-block"));
    if (block && Number.isInteger(index)) go(index);
  };

  const colors = pageColors(reader.settings);
  const style = {
    "--reader-page": colors.page,
    "--reader-text": colors.text,
    "--reader-muted": colors.muted,
    "--reader-font": readerFont(reader.settings.font),
    "--reader-size": `${TEXT_SIZES[reader.settings.textSize]}px`,
  } as CSSProperties;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div
        className="reader min-h-0 flex-1 overflow-hidden rounded-lg border border-border"
        style={style}
        lang={i18n.language}
      >
        <div
          ref={page}
          role="document"
          aria-label={t("quill.play.label", { title: chapter.title })}
          aria-describedby={`${speedId}-status`}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the reading is driven from the keyboard
          tabIndex={0}
          onKeyDown={onKeyDown}
          onClick={onClick}
          className="reader-page scrollbar-thin h-full overflow-y-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <section className="reader-chapter reader-playing">
            <h1 className="reader-chapter-title">{chapter.title}</h1>
            {doc && <BookText doc={doc} />}
          </section>
        </div>
      </div>
      <div
        role="toolbar"
        aria-label={t("quill.play.controls")}
        className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm"
      >
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("quill.play.start")}
            onClick={() => {
              engine.current?.stopAll();
              sounded.current = null;
              go(0);
            }}
          >
            <RotateCcw />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("quill.play.previous")}
            onClick={() => go(line - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button size="sm" onClick={toggle} disabled={lines.length === 0}>
            {running ? <Pause /> : <Play />}
            {t(running ? "quill.play.pause" : "quill.play.play")}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("quill.play.next")}
            onClick={() => go(line + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <span id={`${speedId}-status`} className="text-xs text-muted-foreground tabular-nums">
          {t("quill.play.line", { line: Math.min(line + 1, lines.length), count: lines.length })}
        </span>
        <div className="flex items-center gap-2">
          <label htmlFor={speedId} className="text-xs text-muted-foreground">
            {t("quill.play.speed", { speed: reader.settings.wordsPerMinute })}
          </label>
          <input
            id={speedId}
            type="range"
            min={60}
            max={600}
            step={20}
            value={reader.settings.wordsPerMinute}
            onChange={(event) => reader.change({ wordsPerMinute: Number(event.target.value) })}
            className="w-28 accent-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t(muted ? "quill.play.unmute" : "quill.play.mute")}
            aria-pressed={muted}
            onClick={() => setMuted((value) => !value)}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
          <label htmlFor={volumeId} className="sr-only">
            {t("quill.play.volume")}
          </label>
          <input
            id={volumeId}
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            className="w-24 accent-primary"
          />
        </div>
        {missing > 0 && (
          <span role="status" className="text-xs text-destructive">
            {t("quill.play.missing", { count: missing })}
          </span>
        )}
      </div>
    </div>
  );
}
