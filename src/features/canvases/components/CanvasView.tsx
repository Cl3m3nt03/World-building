import "@excalidraw/excalidraw/index.css";
import {
  CaptureUpdateAction,
  Excalidraw,
  Footer,
  getSceneVersion,
  MainMenu,
  newElementWith,
  restoreElements,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import {
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useResolvedTheme } from "@/app/theme";
import type { Canvas } from "@/lib/bindings";
import { CARD_DROP_EVENT, type CardDropDetail } from "@/lib/cardDrop";
import {
  type Embed,
  type EmbedKind,
  embedAt,
  embedLink,
  embedOf,
  embedSize,
  type PlacedElement,
  placeAt,
} from "../embeds";
import type { KeptState, SceneElement } from "../hooks/useCanvasEditor";
import {
  CURRENT_ITEM,
  isShape,
  optionsFor,
  type Shape,
  type Style,
  type StyledElement,
  type StyleKey,
  shownValue,
  stylePatches,
  type ToolType,
} from "../tools";
import { CanvasToolbar, type ToolbarState } from "./CanvasToolbar";
import { DocumentThumbnail } from "./DocumentThumbnail";

export type CanvasViewHandle = {
  /** Frames every element. */
  recenter: () => void;
};

type Props = {
  canvas: Canvas;
  /** Accessible name of the drawing area. */
  label: string;
  onChange: (elements: readonly SceneElement[], version: number, view: KeptState) => void;
  /** A document's thumbnail was double-clicked (or its link icon clicked). */
  onOpenDocument: (kind: EmbedKind, id: string) => void;
  ref?: Ref<CanvasViewHandle>;
};

/** The saved scene and view, as Excalidraw's initial data. */
function initialData(canvas: Canvas): ExcalidrawInitialDataState {
  let elements: unknown[] = [];
  let state: Partial<KeptState> = {};
  try {
    elements = (JSON.parse(canvas.scene) as { elements?: unknown[] }).elements ?? [];
    state = JSON.parse(canvas.appState) as Partial<KeptState>;
  } catch {
    // A damaged scene opens empty rather than not at all.
  }
  const framed = state.zoom !== undefined && state.scrollX !== undefined;
  return {
    // biome-ignore lint/suspicious/noExplicitAny: Excalidraw restores what it reads
    elements: restoreElements(elements as any, null),
    // Transparent: the world's backdrop shows through, as on the board.
    appState: { ...(framed ? state : {}), viewBackgroundColor: "transparent" } as NonNullable<
      ExcalidrawInitialDataState["appState"]
    >,
    scrollToContent: !framed,
  };
}

/** The style of the next element, from Excalidraw's state. */
function currentStyle(state: AppState): Style {
  return {
    strokeColor: state.currentItemStrokeColor,
    backgroundColor: state.currentItemBackgroundColor,
    fillStyle: state.currentItemFillStyle,
    strokeWidth: state.currentItemStrokeWidth,
    strokeStyle: state.currentItemStrokeStyle,
    roughness: state.currentItemRoughness,
    fontSize: state.currentItemFontSize,
  };
}

/** The selected elements (a text bound to a shape follows it, it is not listed). */
function selectedOf(
  elements: readonly ExcalidrawElement[],
  state: AppState,
): readonly StyledElement[] {
  return elements.filter(
    (element) => state.selectedElementIds[element.id] && !element.isDeleted,
  ) as unknown as StyledElement[];
}

/** What the toolbar shows for this state of Excalidraw. */
function toolbarState(elements: readonly ExcalidrawElement[], state: AppState): ToolbarState {
  const tool = state.activeTool.type;
  const selected = tool === "selection" ? selectedOf(elements, state) : [];
  const options = optionsFor(tool, selected);
  const current = currentStyle(state);
  const values: Partial<Style> = {};
  for (const option of options) {
    (values as Record<StyleKey, unknown>)[option] = shownValue(option, selected, current);
  }
  return { tool, options, values, selection: selected.length > 0 };
}

/**
 * A canvas drawn with Excalidraw (ADR 0001): the app's theme and language,
 * its fonts served by the app, and nothing of Excalidraw that has no sense
 * here (opening or saving files, collaboration, links to excalidraw.com).
 */
export default function CanvasView({ canvas, label, onChange, onOpenDocument, ref }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useResolvedTheme();
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const section = useRef<HTMLElement>(null);
  const [toolbar, setToolbar] = useState<ToolbarState>({
    tool: "selection",
    options: [],
    values: {},
    selection: false,
  });
  // Excalidraw calls onChange on every pointer move: the toolbar is
  // re-rendered only when what it shows changes.
  const toolbarKey = useRef("");
  const [shape, setShape] = useState<Shape>("rectangle");

  const setTool = useCallback((type: ToolType) => {
    api.current?.setActiveTool({ type });
  }, []);

  const setStyle = useCallback(<K extends StyleKey>(key: K, value: Style[K]) => {
    const excalidraw = api.current;
    if (!excalidraw) return;
    const state = excalidraw.getAppState();
    const elements = excalidraw.getSceneElements();
    const patches =
      state.activeTool.type === "selection"
        ? stylePatches(selectedOf(elements, state), key, value)
        : new Map();
    excalidraw.updateScene({
      // biome-ignore lint/suspicious/noExplicitAny: one of the style fields
      appState: { [CURRENT_ITEM[key]]: value } as any,
      elements: patches.size
        ? excalidraw.getSceneElementsIncludingDeleted().map((element) => {
            const patch = patches.get(element.id);
            // biome-ignore lint/suspicious/noExplicitAny: a style of this element's type
            return patch ? newElementWith(element, patch as any) : element;
          })
        : undefined,
      // A change of the selection's style can be undone.
      captureUpdate: patches.size
        ? CaptureUpdateAction.IMMEDIATELY
        : CaptureUpdateAction.EVENTUALLY,
    });
  }, []);

  const remove = useCallback(() => {
    const excalidraw = api.current;
    if (!excalidraw) return;
    const state = excalidraw.getAppState();
    const selected = new Set(selectedOf(excalidraw.getSceneElements(), state).map((e) => e.id));
    excalidraw.updateScene({
      elements: excalidraw.getSceneElementsIncludingDeleted().map((element) =>
        // A text bound to a removed shape goes with it.
        selected.has(element.id) ||
        ("containerId" in element && element.containerId && selected.has(element.containerId))
          ? newElementWith(element, { isDeleted: true })
          : element,
      ),
      appState: { selectedElementIds: {} },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    // The button goes with the selection: Excalidraw keeps the keyboard
    // (Ctrl+Z brings the elements back).
    section.current?.querySelector<HTMLElement>(".excalidraw")?.focus();
  }, []);
  // Read once: Excalidraw owns the scene from then on.
  // biome-ignore lint/correctness/useExhaustiveDependencies: initial data only
  const data = useMemo(() => initialData(canvas), [canvas.id]);

  const openDocument = useRef(onOpenDocument);
  openDocument.current = onOpenDocument;

  /** Adds a document's thumbnail centred on scene point (`x`, `y`), selected. */
  const place = useCallback((embed: Embed, x: number, y: number) => {
    const excalidraw = api.current;
    if (!excalidraw) return;
    // Excalidraw builds the element from its main fields (defaults for the rest).
    const [element] = restoreElements(
      [
        {
          type: "embeddable",
          id: crypto.randomUUID(),
          ...placeAt(embed.kind, x, y),
          ...embedSize(embed.kind),
          link: embedLink(embed),
          strokeColor: "transparent",
          backgroundColor: "transparent",
          roundness: null,
          // biome-ignore lint/suspicious/noExplicitAny: Excalidraw restores what it reads
        } as any,
      ],
      null,
    );
    if (!element) return;
    excalidraw.updateScene({
      elements: [...excalidraw.getSceneElementsIncludingDeleted(), element],
      appState: { selectedElementIds: { [element.id]: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    excalidraw.setActiveTool({ type: "selection" });
  }, []);

  /** The « Insert » tool: in the middle of the view. */
  const insert = useCallback(
    (embed: Embed) => {
      const state = api.current?.getAppState();
      if (!state) return;
      const point = viewportCoordsToSceneCoords(
        {
          clientX: state.offsetLeft + state.width / 2,
          clientY: state.offsetTop + state.height / 2,
        },
        state,
      );
      place(embed, point.x, point.y);
      section.current?.querySelector<HTMLElement>(".excalidraw")?.focus();
    },
    [place],
  );

  useEffect(() => {
    const box = section.current;
    if (!box) return;
    const scenePoint = (clientX: number, clientY: number) => {
      const state = api.current?.getAppState();
      return state ? viewportCoordsToSceneCoords({ clientX, clientY }, state) : null;
    };
    // A card of the sidebar dropped here (DocumentTreeView): its thumbnail,
    // centred where it was dropped.
    const onDrop = (event: Event) => {
      const { cardId, clientX, clientY } = (event as CustomEvent<CardDropDetail>).detail;
      const rect = box.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right) return;
      if (clientY < rect.top || clientY > rect.bottom) return;
      const point = scenePoint(clientX, clientY);
      if (point) place({ kind: "card", id: cardId }, point.x, point.y);
    };
    // A double click on a document opens it (before Excalidraw would start a text there).
    const onDoubleClick = (event: MouseEvent) => {
      const point = scenePoint(event.clientX, event.clientY);
      const elements = api.current?.getSceneElements() as unknown as PlacedElement[] | undefined;
      const embed = point && elements ? embedAt(elements, point.x, point.y) : null;
      if (!embed) return;
      event.stopPropagation();
      event.preventDefault();
      openDocument.current(embed.kind, embed.id);
    };
    // Hovering a document's link icon, Excalidraw shows the link in its
    // tooltip: that link means nothing to read, the tooltip is hidden.
    const hideCardLinks = () => {
      const tip = document.querySelector(".excalidraw-tooltip--visible");
      if (tip && embedOf(tip.textContent?.trim()))
        tip.classList.remove("excalidraw-tooltip--visible");
    };
    const tooltips = new MutationObserver(hideCardLinks);
    tooltips.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributeFilter: ["class"],
    });
    window.addEventListener(CARD_DROP_EVENT, onDrop);
    box.addEventListener("dblclick", onDoubleClick, { capture: true });
    return () => {
      tooltips.disconnect();
      window.removeEventListener(CARD_DROP_EVENT, onDrop);
      box.removeEventListener("dblclick", onDoubleClick, { capture: true });
    };
  }, [place]);

  useImperativeHandle(ref, () => ({
    recenter: () => {
      const elements = api.current?.getSceneElements() ?? [];
      api.current?.scrollToContent(elements, { fitToViewport: true, animate: true });
    },
  }));

  return (
    <section
      ref={section}
      aria-label={label}
      className="bz-canvas size-full overflow-hidden rounded-lg"
    >
      <Excalidraw
        initialData={data}
        excalidrawAPI={(instance) => {
          api.current = instance;
        }}
        theme={theme}
        langCode={i18n.language.startsWith("fr") ? "fr-FR" : "en"}
        onChange={(elements, appState) => {
          onChange(
            elements as unknown as readonly SceneElement[],
            getSceneVersion(elements),
            appState as unknown as KeptState,
          );
          const next = toolbarState(elements, appState);
          const key = JSON.stringify(next);
          if (key !== toolbarKey.current) {
            toolbarKey.current = key;
            setToolbar(next);
            if (isShape(next.tool)) setShape(next.tool);
          }
        }}
        // Only BuilderZ's own embeds (world documents): no web page is ever loaded.
        validateEmbeddable={(link) => embedOf(link) !== null}
        // A document's link icon opens it (its link leads nowhere).
        onLinkOpen={(element, event) => {
          const embed = embedOf(element.link);
          if (!embed) return;
          event.preventDefault();
          openDocument.current(embed.kind, embed.id);
        }}
        renderEmbeddable={(element) => {
          const embed = embedOf(element.link);
          return embed ? <DocumentThumbnail embed={embed} /> : null;
        }}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            toggleTheme: false,
            changeViewBackgroundColor: false,
          },
          // Images come from the world's media library (step 7.9).
          tools: { image: false },
        }}
      >
        {/* Only what makes sense in BuilderZ (no file, no link to excalidraw.com). */}
        <MainMenu>
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.DefaultItems.Help />
        </MainMenu>
        <Footer>
          <CanvasToolbar
            {...toolbar}
            shape={shape}
            onTool={setTool}
            onStyle={setStyle}
            onRemove={remove}
            onInsert={insert}
          />
        </Footer>
      </Excalidraw>
      <span className="sr-only">{t("canvases.hint")}</span>
    </section>
  );
}
