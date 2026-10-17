import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ChartGantt, ExternalLink, RefreshCw } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimelineView } from "@/features/timelines/components/TimelineView";
import { useTimeline } from "@/features/timelines/hooks/useTimelines";
import { useCalendar } from "@/features/timelines/useCalendar";
import { commands } from "@/lib/bindings";
import { useDocumentLink } from "@/lib/documentLinks";
import { timelineCardRoute } from "@/lib/documentRoute";
import { unwrap } from "@/lib/ipc";
import { documentKeys } from "../hooks/keys";
import { useCardList } from "../hooks/useCards";
import type { TimelineBlock } from "./model";

/** Live timelines of the world, by title, to choose the one a block shows. */
function useWorldTimelines() {
  return useQuery({
    queryKey: [...documentKeys.all(), "timelines"],
    queryFn: () => unwrap(commands.listDocuments({ kind: "timeline", trashed: false })),
  });
}

/**
 * A timeline of the world inside a card (M11 step 11.5): chosen among the
 * timelines, shown read-only and centred on this card's item when it has
 * one (the wheel scrolls the card, Ctrl + wheel zooms), with a button to
 * open it.
 */
export function TimelineBlockView({
  block,
  label,
  onChange,
}: {
  block: TimelineBlock;
  label: string;
  onChange: (block: TimelineBlock) => void;
}) {
  const { t } = useTranslation();
  const timelines = useWorldTimelines();
  const [choosing, setChoosing] = useState(block.timelineId === null);
  const selectId = useId();

  const chooser = (
    <div className="flex min-w-48 flex-col gap-1 self-start">
      <label htmlFor={selectId} className="text-sm text-muted-foreground">
        {t("blocks.timeline.choose")}
      </label>
      <Select
        value={block.timelineId ?? ""}
        onValueChange={(timelineId) => {
          onChange({ ...block, timelineId });
          setChoosing(false);
        }}
        // Closed on the same timeline (no change), or with Escape: back to it.
        onOpenChange={(open) => {
          if (!open && block.timelineId !== null) setChoosing(false);
        }}
      >
        <SelectTrigger id={selectId} size="sm">
          <SelectValue placeholder={t("blocks.timeline.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {(timelines.data ?? []).map((timeline) => (
            <SelectItem key={timeline.id} value={timeline.id}>
              {timeline.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <figure aria-label={label} className="flex flex-col gap-2">
      {block.timelineId === null || choosing ? (
        timelines.data && timelines.data.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            <ChartGantt aria-hidden className="size-5" />
            {t("blocks.timeline.none")}
          </p>
        ) : (
          chooser
        )
      ) : (
        <TimelinePreview timelineId={block.timelineId} onChange={() => setChoosing(true)} />
      )}
    </figure>
  );
}

function TimelinePreview({ timelineId, onChange }: { timelineId: string; onChange: () => void }) {
  const { t } = useTranslation();
  const { worldId, cardId } = useParams({ strict: false });
  const timeline = useTimeline(timelineId);
  const cards = useCardList(false);
  const { calendar } = useCalendar();
  const cardsById = useMemo(
    () => new Map((cards.data ?? []).map((card) => [card.id, card])),
    [cards.data],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const resolved = useDocumentLink()("timeline", timelineId);
  // This card's item, if it is on the timeline: the view and the link centre on it.
  const own = cardId ? timeline.data?.items.find((item) => item.cardId === cardId) : undefined;
  const link =
    resolved?.to === "/world/$worldId/world/timeline/$timelineId" && worldId && cardId && own
      ? timelineCardRoute(worldId, timelineId, cardId)
      : resolved;

  if (timeline.isError) {
    return <p className="text-sm text-muted-foreground">{t("blocks.timeline.missing")}</p>;
  }
  if (!timeline.data) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <ChartGantt aria-hidden className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{timeline.data.title}</span>
        {link && (
          <Button asChild variant="secondary" size="xs">
            <Link {...link}>
              <ExternalLink />
              {t("blocks.timeline.open")}
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="xs" onClick={onChange}>
          <RefreshCw />
          {t("blocks.timeline.change")}
        </Button>
      </div>
      <div className="flex h-72 flex-col">
        <TimelineView
          timeline={timeline.data}
          calendar={calendar}
          cardsById={cardsById}
          label={t("timelines.viewLabel", { name: timeline.data.title })}
          selectedId={selectedId}
          onSelect={setSelectedId}
          focusId={own?.id ?? null}
          embedded
        />
      </div>
    </>
  );
}
