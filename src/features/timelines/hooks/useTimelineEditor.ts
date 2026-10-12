import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { documentKeys } from "@/features/cards/hooks/keys";
import { commands, type Timeline, type TimelineItem } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { timelineKeys } from "./useTimelines";

/** A change the history can undo: its inverse is worked out before it runs. */
export type TimelineOp =
  | { kind: "save"; item: TimelineItem }
  | { kind: "delete"; id: string }
  | { kind: "track"; id: string; name: string; color: string }
  | { kind: "moveTrack"; id: string; index: number };

/** Most changes kept for « Annuler ». */
const HISTORY = 100;

function inverseOf(timeline: Timeline, op: TimelineOp): TimelineOp | null {
  switch (op.kind) {
    case "save": {
      const before = timeline.items.find((item) => item.id === op.item.id);
      return before ? { kind: "save", item: before } : { kind: "delete", id: op.item.id };
    }
    case "delete": {
      const before = timeline.items.find((item) => item.id === op.id);
      return before ? { kind: "save", item: before } : null;
    }
    case "track": {
      const before = timeline.tracks.find((track) => track.id === op.id);
      return before ? { kind: "track", id: op.id, name: before.name, color: before.color } : null;
    }
    case "moveTrack": {
      const index = timeline.tracks.findIndex((track) => track.id === op.id);
      return index >= 0 ? { kind: "moveTrack", id: op.id, index } : null;
    }
  }
}

function run(op: TimelineOp): Promise<Timeline> {
  switch (op.kind) {
    case "save":
      return unwrap(commands.saveTimelineItem(op.item));
    case "delete":
      return unwrap(commands.deleteTimelineItem(op.id));
    case "track":
      return unwrap(commands.updateTimelineTrack(op.id, op.name, op.color));
    case "moveTrack":
      return unwrap(commands.moveTimelineTrack(op.id, op.index));
  }
}

/** Whether a change may alter the cards the timeline cites. */
function touchesCards(timeline: Timeline, op: TimelineOp): boolean {
  if (op.kind === "save") {
    const before = timeline.items.find((item) => item.id === op.item.id);
    return (before?.cardId ?? null) !== op.item.cardId;
  }
  if (op.kind === "delete") {
    return Boolean(timeline.items.find((item) => item.id === op.id)?.cardId);
  }
  return false;
}

type Entry = { op: TimelineOp; inverse: TimelineOp };

/**
 * Edits a timeline (11.4): every change goes to Rust in turn (one at a
 * time, in order) and the timeline shown is the one Rust gives back. The
 * changes of items and tracks can be undone and redone; adding or deleting
 * a track cannot (a deleted track's items are gone), and deleting one
 * forgets the history.
 */
export function useTimelineEditor(timelineId: string) {
  const queryClient = useQueryClient();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const past = useRef<Entry[]>([]);
  const future = useRef<Entry[]>([]);
  const [, setVersion] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const bump = useCallback(() => setVersion((version) => version + 1), []);

  const current = useCallback(
    () => queryClient.getQueryData<Timeline>(timelineKeys.detail(timelineId)),
    [queryClient, timelineId],
  );

  /** Runs `task` after the changes before it; its timeline becomes the one shown. */
  const enqueue = useCallback(
    (task: (timeline: Timeline) => Promise<Timeline | null>) => {
      const next = queue.current.then(async () => {
        const timeline = current();
        if (!timeline) return;
        try {
          const result = await task(timeline);
          if (result) queryClient.setQueryData(timelineKeys.detail(timelineId), result);
          setError(null);
        } catch (caught) {
          setError(caught);
        }
      });
      queue.current = next;
      return next;
    },
    [current, queryClient, timelineId],
  );

  const perform = useCallback(
    (timeline: Timeline, op: TimelineOp) =>
      run(op).then(async (result) => {
        if (touchesCards(timeline, op)) {
          await queryClient.invalidateQueries({ queryKey: documentKeys.all() });
        }
        return result;
      }),
    [queryClient],
  );

  const apply = useCallback(
    (op: TimelineOp) =>
      enqueue(async (timeline) => {
        const inverse = inverseOf(timeline, op);
        const result = await perform(timeline, op);
        if (inverse) {
          past.current = [...past.current, { op, inverse }].slice(-HISTORY);
          future.current = [];
          bump();
        }
        return result;
      }),
    [enqueue, perform, bump],
  );

  const undo = useCallback(
    () =>
      enqueue(async (timeline) => {
        const entry = past.current.at(-1);
        if (!entry) return null;
        const result = await perform(timeline, entry.inverse);
        past.current = past.current.slice(0, -1);
        future.current = [...future.current, entry];
        bump();
        return result;
      }),
    [enqueue, perform, bump],
  );

  const redo = useCallback(
    () =>
      enqueue(async (timeline) => {
        const entry = future.current.at(-1);
        if (!entry) return null;
        const result = await perform(timeline, entry.op);
        future.current = future.current.slice(0, -1);
        past.current = [...past.current, entry];
        bump();
        return result;
      }),
    [enqueue, perform, bump],
  );

  const addTrack = useCallback(
    (name: string, color: string) =>
      enqueue(() => unwrap(commands.addTimelineTrack(timelineId, name, color))),
    [enqueue, timelineId],
  );

  const deleteTrack = useCallback(
    (id: string) =>
      enqueue(async (timeline) => {
        const result = await unwrap(commands.deleteTimelineTrack(id));
        past.current = [];
        future.current = [];
        bump();
        if (timeline.items.some((item) => item.trackId === id && item.cardId)) {
          await queryClient.invalidateQueries({ queryKey: documentKeys.all() });
        }
        return result;
      }),
    [enqueue, queryClient, bump],
  );

  return {
    apply,
    undo,
    redo,
    addTrack,
    deleteTrack,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    error,
  };
}

export type TimelineEditor = ReturnType<typeof useTimelineEditor>;
