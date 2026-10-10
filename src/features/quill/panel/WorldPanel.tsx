import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import {
  type DockviewApi,
  DockviewReact,
  type DockviewTheme,
  type IDockviewPanelProps,
} from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { Columns2, House, Map as MapIcon, Palette, Share2, SquareUser } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCardTypes } from "@/features/card-types";
import { CardPicker, useCardList } from "@/features/cards";
import { HomeGraphPreview } from "@/features/graphs";
import { hiddenLayers, MapTextView, MapView, PinMarker, useMap } from "@/features/maps";
import { commands, type MapPin } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { CompareView } from "../drafts/CompareView";
import { CardPanel } from "../world/CardPanel";
import { HomeBoard } from "./HomeBoard";
import type { WritingStyle } from "./layout";
import { usePanelWorld } from "./PanelContext";

/** dockview's look, from the app's tokens (globals.css). */
const THEME: DockviewTheme = { name: "builderz", className: "dockview-theme-bz" };

export type WorldPanelHandle = { openCard: (cardId: string) => void };

/** Ids of the tabs the panel always offers. */
const FIXED = ["home", "drafts", "style"] as const;

function HomeTab() {
  return <HomeBoard />;
}

function DraftsTab() {
  const { t } = useTranslation();
  const { chapter } = usePanelWorld();
  const [picked, setPicked] = useState<{ left: string; right: string } | null>(null);
  if (!chapter) return null;
  const other = chapter.drafts.find((draft) => draft.id !== chapter.currentDraftId);
  if (!other) {
    return <p className="p-4 text-sm text-muted-foreground">{t("quill.panel.oneDraft")}</p>;
  }
  const valid = (id: string | undefined) => chapter.drafts.some((draft) => draft.id === id);
  const left = picked && valid(picked.left) ? picked.left : chapter.currentDraftId;
  const right = picked && valid(picked.right) ? picked.right : other.id;
  return (
    <div className="h-full p-2">
      <CompareView
        chapter={chapter}
        leftId={left}
        rightId={right}
        onPick={(nextLeft, nextRight) => setPicked({ left: nextLeft, right: nextRight })}
      />
    </div>
  );
}

const STYLES: WritingStyle[] = ["world", "light", "dark"];

function StyleTab() {
  const { t } = useTranslation();
  const { layout, update } = usePanelWorld();
  return (
    <fieldset className="flex flex-col gap-3 p-4">
      <legend className="mb-2 text-sm font-medium">{t("quill.panel.styleLegend")}</legend>
      <RadioGroup
        value={layout.style}
        onValueChange={(style) =>
          update((current) => ({ ...current, style: style as WritingStyle }))
        }
        className="flex flex-col gap-2"
      >
        {STYLES.map((style) => (
          <div key={style} className="flex items-center gap-2">
            <RadioGroupItem value={style} id={`quill-style-${style}`} />
            <Label htmlFor={`quill-style-${style}`}>{t(`quill.panel.style.${style}`)}</Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

function CardTab(props: IDockviewPanelProps<{ cardId: string }>) {
  const { openCard } = usePanelWorld();
  const cards = useCardList(false);
  const title = cards.data?.find((card) => card.id === props.params.cardId)?.title;
  // The tab follows the card's name.
  useEffect(() => {
    if (title) props.api.setTitle(title);
  }, [title, props.api]);
  return (
    <div className="h-full p-3">
      <CardPanel cardId={props.params.cardId} onOpen={openCard} />
    </div>
  );
}

function MapTab(props: IDockviewPanelProps<{ mapId: string }>) {
  const { t } = useTranslation();
  const { openCard } = usePanelWorld();
  const map = useMap(props.params.mapId);
  const cards = useCardList(false);
  const types = useCardTypes();
  const content = map.data?.content;
  const hidden = useMemo(() => (content ? hiddenLayers(content) : new Set<string>()), [content]);
  const pins = useMemo(
    () => content?.pins.filter((pin) => !hidden.has(pin.layerId)) ?? [],
    [content, hidden],
  );
  const markers = useMemo(
    () => [...(content?.texts.filter((text) => !hidden.has(text.layerId)) ?? []), ...pins],
    [content, hidden, pins],
  );
  const zones = useMemo(
    () => content?.zones.filter((zone) => !hidden.has(zone.layerId)) ?? [],
    [content, hidden],
  );
  useEffect(() => {
    if (map.data) props.api.setTitle(map.data.title);
  }, [map.data, props.api]);
  if (!map.data || !content) return null;
  const cardOf = (pin: MapPin) =>
    pin.cardId ? cards.data?.find((card) => card.id === pin.cardId) : undefined;
  return (
    <div className="h-full p-2">
      <MapView
        readOnly
        backgroundAssetId={map.data.backgroundAssetId}
        tiles={map.data.tiled ? { mapId: map.data.id } : null}
        width={map.data.width}
        height={map.data.height}
        label={t("maps.viewLabel", { name: map.data.title })}
        markers={markers}
        zones={zones}
        markerLabel={(id) => {
          const pin = pins.find((other) => other.id === id);
          const text = content.texts.find((other) => other.id === id);
          return (pin && (cardOf(pin)?.title ?? pin.label)) || text?.text || "";
        }}
        renderMarker={(id, zoomScale) => {
          const text = content.texts.find((other) => other.id === id);
          if (text) return <MapTextView text={text} zoomScale={zoomScale} selected={false} />;
          const pin = pins.find((other) => other.id === id);
          if (!pin) return null;
          const card = cardOf(pin);
          return (
            <PinMarker
              pin={pin}
              card={card}
              type={types.data?.find((type) => type.id === card?.typeId)}
              selected={false}
            />
          );
        }}
        onMarkerClick={(id) => {
          const cardId = pins.find((pin) => pin.id === id)?.cardId;
          if (cardId) openCard(cardId);
        }}
      />
    </div>
  );
}

function GraphTab() {
  const { worldId } = useParams({ from: "/world/$worldId" });
  const { openCard } = usePanelWorld();
  return (
    <div className="h-full p-2">
      <HomeGraphPreview worldId={worldId} onOpen={openCard} />
    </div>
  );
}

const COMPONENTS = {
  home: HomeTab,
  drafts: DraftsTab,
  style: StyleTab,
  card: CardTab,
  map: MapTab,
  graph: GraphTab,
} as Record<string, React.FunctionComponent<IDockviewPanelProps>>;

/**
 * The world panel, right of the text (docs/features/08-quill.md): tabs kept
 * open side by side (dockview). Home holds free blocks, Brouillons compares
 * the chapter's drafts, Style sets the writing mode's look; the icons open a
 * card, a map or the graph in tabs of their own. The layout is kept per story.
 */
export const WorldPanel = forwardRef<WorldPanelHandle>(function WorldPanel(_props, ref) {
  const { t } = useTranslation();
  const world = usePanelWorld();
  const api = useRef<DockviewApi | null>(null);
  const [pickingCard, setPickingCard] = useState(false);
  const maps = useQuery({
    queryKey: ["documents", "maps-for-quill"],
    queryFn: () => unwrap(commands.listDocuments({ kind: "map", trashed: false })),
  });
  const titles: Record<(typeof FIXED)[number] | "graph", string> = {
    home: t("quill.panel.home"),
    drafts: t("quill.panel.drafts"),
    style: t("quill.panel.styleTab"),
    graph: t("quill.panel.graph"),
  };

  const open = (id: string, component: string, title: string, params?: Record<string, string>) => {
    const dock = api.current;
    if (!dock) return;
    const existing = dock.getPanel(id);
    if (existing) {
      existing.api.setActive();
      return;
    }
    dock.addPanel({ id, component, title, ...(params ? { params } : {}) });
  };
  // The tab takes the card's name once it has read it (`CardTab`).
  const openCard = (cardId: string) =>
    open(`card-${cardId}`, "card", t("quill.panel.cardTab"), { cardId });
  useImperativeHandle(ref, () => ({ openCard }));

  const fixedTab = (id: (typeof FIXED)[number] | "graph") => () => open(id, id, titles[id]);

  return (
    <aside
      aria-label={t("quill.panel.label")}
      className="flex min-h-0 flex-col gap-1 border-l border-border pl-3"
    >
      <div role="toolbar" aria-label={t("quill.panel.tools")} className="flex items-center gap-0.5">
        <PanelButton label={titles.home} onClick={fixedTab("home")} icon={<House />} />
        <PanelButton label={titles.drafts} onClick={fixedTab("drafts")} icon={<Columns2 />} />
        <PanelButton label={titles.style} onClick={fixedTab("style")} icon={<Palette />} />
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        <CardPicker
          open={pickingCard}
          onOpenChange={setPickingCard}
          label={t("quill.panel.pickCard")}
          allowedTypeIds={[]}
          onPick={(cardId) => {
            setPickingCard(false);
            openCard(cardId);
          }}
        >
          <Button variant="ghost" size="icon-sm" aria-label={t("quill.panel.openCardTab")}>
            <SquareUser />
          </Button>
        </CardPicker>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("quill.panel.openMap")}>
              <MapIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="flex w-56 flex-col p-1">
            {(maps.data ?? []).length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">{t("quill.panel.noMap")}</p>
            ) : (
              (maps.data ?? []).map((map) => (
                <button
                  key={map.id}
                  type="button"
                  onClick={() => open(`map-${map.id}`, "map", map.title, { mapId: map.id })}
                  className="rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
                >
                  {map.title}
                </button>
              ))
            )}
          </PopoverContent>
        </Popover>
        <PanelButton label={titles.graph} onClick={fixedTab("graph")} icon={<Share2 />} />
      </div>
      <div className="min-h-0 flex-1">
        <DockviewReact
          className="h-full"
          theme={THEME}
          components={COMPONENTS}
          onReady={(event) => {
            api.current = event.api;
            const dock = world.layout.dock;
            let restored = false;
            if (dock) {
              try {
                event.api.fromJSON(dock as Parameters<DockviewApi["fromJSON"]>[0]);
                restored = event.api.panels.length > 0;
              } catch {
                event.api.clear();
              }
            }
            if (!restored) {
              for (const id of FIXED) event.api.addPanel({ id, component: id, title: titles[id] });
              event.api.getPanel("home")?.api.setActive();
            }
            event.api.onDidLayoutChange(() => {
              const json = event.api.toJSON();
              world.update((current) => ({ ...current, dock: json }));
            });
          }}
        />
      </div>
    </aside>
  );
});

function PanelButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
