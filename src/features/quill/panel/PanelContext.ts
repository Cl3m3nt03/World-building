import { useMutation, useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { type Chapter, commands, type StoryNote } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { quillKeys } from "../hooks/useQuill";
import { type PanelLayout, readLayout } from "./layout";

/** Pause after the last change of the panel before its layout is kept. */
const SAVE_DELAY_MS = 600;

/** What the world panel's tabs need from the writing space. */
export type PanelWorld = {
  storyId: string;
  /** The chapter open in the editor (its drafts in the Drafts tab). */
  chapter: Chapter | null;
  layout: PanelLayout;
  update: (change: (layout: PanelLayout) => PanelLayout) => void;
  openCard: (cardId: string) => void;
  openNote: (note: StoryNote) => void;
};

export const PanelContext = createContext<PanelWorld | null>(null);

export function usePanelWorld(): PanelWorld {
  const world = useContext(PanelContext);
  if (!world) throw new Error("the world panel's tabs need its context");
  return world;
}

/**
 * A story's panel layout: read once, then kept as it changes (a little after
 * the last change, and when the story is left).
 */
export function usePanelLayout(storyId: string) {
  const stored = useQuery({
    queryKey: [...quillKeys.all(), "panel", storyId],
    queryFn: () => unwrap(commands.writingPanel(storyId)),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [layout, setLayout] = useState<PanelLayout | null>(null);
  const save = useMutation({
    mutationFn: (value: PanelLayout) =>
      unwrap(commands.saveWritingPanel(storyId, JSON.stringify(value))),
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<PanelLayout | null>(null);
  const saveRef = useRef(save.mutate);
  saveRef.current = save.mutate;

  useEffect(() => {
    if (stored.data !== undefined && layout === null) setLayout(readLayout(stored.data));
  }, [stored.data, layout]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current) saveRef.current(pending.current);
    },
    [],
  );

  const update = (change: (current: PanelLayout) => PanelLayout) =>
    setLayout((current) => {
      if (!current) return current;
      const next = change(current);
      pending.current = next;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (pending.current) saveRef.current(pending.current);
        pending.current = null;
      }, SAVE_DELAY_MS);
      return next;
    });

  return { layout, update, error: stored.error ?? save.error };
}
