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
  embeddableAt,
  embedLink,
  embedOf,
  embedSize,
  isOwnLink,
  type PlacedElement,
  placeAt,
} from "../embeds";
import type { KeptState, SceneElement } from "../hooks/useCanvasEditor";
import { isNoteLink, NEW_NOTE, NOTE_LINK, NOTE_SIZE, type Note, noteOf } from "../notes";
import { boxOf, bubblePoints, cloudPoints, DEFAULT_SHAPE_SIZE, MIN_SHAPE_SIZE } from "../shapes";
import {
  CURRENT_ITEM,
  isOwnShape,
  isShape,
  type OwnShape,
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
import { NoteView } from "./NoteView";

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

/** Whether a line closes on itself (a cloud, a bubble): it is filled like a shape. */
function isLoop(element: ExcalidrawElement): boolean {
  if (element.type !== "line") return false;
  const first = element.points[0];
  const last = element.points.at(-1);
  return (
    element.points.length > 2 &&
    first !== undefined &&
    last !== undefined &&
    first[0] === last[0] &&
    first[1] === last[1]
  );
}

/**
 * The selected elements (a text bound to a shape follows it, it is not
 * listed); a closed line is styled as a « loop ».
 */
function selectedOf(
  elements: readonly ExcalidrawElement[],
  state: AppState,
): readonly StyledElement[] {
  return elements
    .filter((element) => state.selectedElementIds[element.id] && !element.isDeleted)
    .map((element) =>
      isLoop(element) ? { ...element, type: "loop" } : element,
    ) as unknown as StyledElement[];
}

/** What the toolbar shows for this state of Excalidraw. */
function toolbarState(elements: readonly ExcalidrawElement[], state: AppState): ToolbarState {
  // BuilderZ's own shapes are Excalidraw « custom » tools.
  const tool =
    state.activeTool.type === "custom" ? state.activeTool.customType : state.activeTool.type;
  const selected = tool === "selection" ? selectedOf(elements, state) : [];
  const options = optionsFor(tool, selected);
  const current = currentStyle(state);
  const values: Partial<Style> = {};
  for (const option of options) {
    (values as Record<StyleKey, unknown>)[option] = shownValue(option, selected, current);
  }
  const notes = selected.filter(
    (element) => element.type === "embeddable" && isNoteLink((element as { link?: string }).link),
  );
  const note =
    notes.length > 0 && notes.length === selected.length
      ? (() => {
          const all = notes.map((element) =>
            noteOf((element as { customData?: unknown }).customData),
          );
          const same = <K extends "color" | "pattern">(key: K) =>
            all.every((each) => each[key] === all[0]?.[key]) ? all[0]?.[key] : undefined;
          return { color: same("color"), pattern: same("pattern") };
        })()
      : undefined;
  return { tool, options, values, selection: selected.length > 0, note };
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
  const [ready, setReady] = useState(false);
  // The box of a cloud or bubble being drawn, in the section's pixels.
  const [drawing, setDrawing] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
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
    api.current?.setActiveTool(isOwnShape(type) ? { type: "custom", customType: type } : { type });
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

  /** Adds one of BuilderZ's embeddables (a document, a note), selected; gives its id. */
  const addEmbeddable = useCallback(
    (fields: {
      x: number;
      y: number;
      width: number;
      height: number;
      link: string;
      customData?: Record<string, unknown>;
    }) => {
      const excalidraw = api.current;
      if (!excalidraw) return null;
      // Excalidraw builds the element from its main fields (defaults for the rest).
      const [element] = restoreElements(
        [
          {
            type: "embeddable",
            id: crypto.randomUUID(),
            ...fields,
            strokeColor: "transparent",
            backgroundColor: "transparent",
            roundness: null,
            // biome-ignore lint/suspicious/noExplicitAny: Excalidraw restores what it reads
          } as any,
        ],
        null,
      );
      if (!element) return null;
      excalidraw.updateScene({
        elements: [...excalidraw.getSceneElementsIncludingDeleted(), element],
        appState: { selectedElementIds: { [element.id]: true } },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      excalidraw.setActiveTool({ type: "selection" });
      return element.id;
    },
    [],
  );

  /** Adds a document's thumbnail centred on scene point (`x`, `y`), selected. */
  const place = useCallback(
    (embed: Embed, x: number, y: number) =>
      addEmbeddable({
        ...placeAt(embed.kind, x, y),
        ...embedSize(embed.kind),
        link: embedLink(embed),
      }),
    [addEmbeddable],
  );

  /** The middle of the view, in scene coordinates. */
  const viewCentre = useCallback(() => {
    const state = api.current?.getAppState();
    return state
      ? viewportCoordsToSceneCoords(
          {
            clientX: state.offsetLeft + state.width / 2,
            clientY: state.offsetTop + state.height / 2,
          },
          state,
        )
      : null;
  }, []);

  /** The « Insert » tool: in the middle of the view. */
  const insert = useCallback(
    (embed: Embed) => {
      const point = viewCentre();
      if (!point) return;
      place(embed, point.x, point.y);
      section.current?.querySelector<HTMLElement>(".excalidraw")?.focus();
    },
    [place, viewCentre],
  );

  // --- Notes ---------------------------------------------------------------
  // The note written in, if any: Excalidraw lets the pointer into it while
  // it is its « active » embeddable.
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const editing = useRef<string | null>(null);
  editing.current = editingNote;

  const startWriting = useCallback((id: string) => {
    const excalidraw = api.current;
    const element = excalidraw?.getSceneElements().find((each) => each.id === id);
    if (!excalidraw || !element) return;
    setEditingNote(id);
    excalidraw.updateScene({
      appState: {
        selectedElementIds: { [id]: true },
        // biome-ignore lint/suspicious/noExplicitAny: Excalidraw's own embeddable type
        activeEmbeddable: { element: element as any, state: "active" },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
  }, []);

  /** A note changed while written: in the scene at once, one undo step when done. */
  const writeNote = useCallback((id: string, note: Note) => {
    const excalidraw = api.current;
    const element = excalidraw?.getSceneElementsIncludingDeleted().find((each) => each.id === id);
    if (!excalidraw || !element) return;
    const next = newElementWith(element, { customData: note });
    excalidraw.updateScene({
      elements: excalidraw
        .getSceneElementsIncludingDeleted()
        .map((each) => (each.id === id ? next : each)),
      // biome-ignore lint/suspicious/noExplicitAny: Excalidraw's own embeddable type
      appState: { activeEmbeddable: { element: next as any, state: "active" } },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
  }, []);

  const stopWriting = useCallback(() => {
    if (editing.current === null) return;
    setEditingNote(null);
    api.current?.updateScene({
      appState: { activeEmbeddable: null },
      // What was written becomes one step to undo.
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    section.current?.querySelector<HTMLElement>(".excalidraw")?.focus();
  }, []);

  /** The « Notes » tool: a new note in the middle of the view, to write in at once. */
  const addNote = useCallback(() => {
    const point = viewCentre();
    if (!point) return;
    const id = addEmbeddable({
      x: point.x - NOTE_SIZE.width / 2,
      y: point.y - NOTE_SIZE.height / 2,
      ...NOTE_SIZE,
      link: NOTE_LINK,
      customData: { ...NEW_NOTE },
    });
    if (id) startWriting(id);
  }, [addEmbeddable, startWriting, viewCentre]);

  const setNoteStyle = useCallback((patch: Partial<Pick<Note, "color" | "pattern">>) => {
    const excalidraw = api.current;
    if (!excalidraw) return;
    const state = excalidraw.getAppState();
    excalidraw.updateScene({
      elements: excalidraw
        .getSceneElementsIncludingDeleted()
        .map((element) =>
          state.selectedElementIds[element.id] && !element.isDeleted && isNoteLink(element.link)
            ? newElementWith(element, { customData: { ...noteOf(element.customData), ...patch } })
            : element,
        ),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, []);

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
    // A double click on a document opens it, on a note writes in it (before
    // Excalidraw would start a text there).
    const onDoubleClick = (event: MouseEvent) => {
      const point = scenePoint(event.clientX, event.clientY);
      const elements = api.current?.getSceneElements() as unknown as
        | (PlacedElement & { id: string })[]
        | undefined;
      if (!point || !elements) return;
      const note = embeddableAt(elements, point.x, point.y, (each) => isNoteLink(each.link));
      const embed = note ? null : embedAt(elements, point.x, point.y);
      if (!note && !embed) return;
      event.stopPropagation();
      event.preventDefault();
      if (note) startWriting(note.id);
      else if (embed) openDocument.current(embed.kind, embed.id);
    };
    // Hovering a document's link icon, Excalidraw shows the link in its
    // tooltip: that link means nothing to read, the tooltip is hidden.
    const hideCardLinks = () => {
      const tip = document.querySelector(".excalidraw-tooltip--visible");
      if (tip && isOwnLink(tip.textContent?.trim()))
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
  }, [place, startWriting]);

  // --- The cloud and the bubble ---------------------------------------------
  // Drawn like Excalidraw's shapes: press, drag the box, release (a click
  // places one of the default size). They become closed lines in the
  // current style, selected.
  useEffect(() => {
    const excalidraw = api.current;
    const box = section.current;
    if (!ready || !excalidraw || !box) return;
    let start: { clientX: number; clientY: number } | null = null;
    const shapeOf = (tool: AppState["activeTool"]): OwnShape | null =>
      tool.type === "custom" && isOwnShape(tool.customType) ? tool.customType : null;
    const track = (event: PointerEvent) => {
      if (!start) return;
      const rect = box.getBoundingClientRect();
      const corner = boxOf(
        { x: start.clientX, y: start.clientY },
        { x: event.clientX, y: event.clientY },
      );
      setDrawing({ ...corner, x: corner.x - rect.left, y: corner.y - rect.top });
    };
    const offDown = excalidraw.onPointerDown((tool, _, event) => {
      if (!shapeOf(tool) || event.button !== 0) return;
      start = { clientX: event.clientX, clientY: event.clientY };
      window.addEventListener("pointermove", track);
    });
    const offUp = excalidraw.onPointerUp((tool, _, event) => {
      const shape = shapeOf(tool);
      window.removeEventListener("pointermove", track);
      setDrawing(null);
      if (!shape || !start) return;
      const state = excalidraw.getAppState();
      const from = viewportCoordsToSceneCoords(start, state);
      const to = viewportCoordsToSceneCoords(
        { clientX: event.clientX, clientY: event.clientY },
        state,
      );
      start = null;
      let area = boxOf(from, to);
      if (area.width < MIN_SHAPE_SIZE || area.height < MIN_SHAPE_SIZE) {
        area = {
          x: from.x - DEFAULT_SHAPE_SIZE.width / 2,
          y: from.y - DEFAULT_SHAPE_SIZE.height / 2,
          ...DEFAULT_SHAPE_SIZE,
        };
      }
      const points = (shape === "cloud" ? cloudPoints : bubblePoints)(area.width, area.height);
      const [element] = restoreElements(
        [
          {
            type: "line",
            id: crypto.randomUUID(),
            x: area.x,
            y: area.y,
            width: area.width,
            height: area.height,
            points,
            strokeColor: state.currentItemStrokeColor,
            backgroundColor: state.currentItemBackgroundColor,
            fillStyle: state.currentItemFillStyle,
            strokeWidth: state.currentItemStrokeWidth,
            strokeStyle: state.currentItemStrokeStyle,
            roughness: state.currentItemRoughness,
            opacity: state.currentItemOpacity,
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
      // As after Excalidraw's own shapes: back to selecting.
      excalidraw.setActiveTool({ type: "selection" });
    });
    return () => {
      offDown();
      offUp();
      window.removeEventListener("pointermove", track);
    };
  }, [ready]);

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
      className="bz-canvas relative size-full overflow-hidden rounded-lg"
    >
      <Excalidraw
        initialData={data}
        excalidrawAPI={(instance) => {
          api.current = instance;
          setReady(true);
        }}
        theme={theme}
        langCode={i18n.language.startsWith("fr") ? "fr-FR" : "en"}
        onChange={(elements, appState) => {
          onChange(
            elements as unknown as readonly SceneElement[],
            getSceneVersion(elements),
            appState as unknown as KeptState,
          );
          if (editing.current && appState.activeEmbeddable?.element.id !== editing.current) {
            stopWriting();
          }
          const next = toolbarState(elements, appState);
          const key = JSON.stringify(next);
          if (key !== toolbarKey.current) {
            toolbarKey.current = key;
            setToolbar(next);
            if (isShape(next.tool)) setShape(next.tool);
          }
        }}
        // Only BuilderZ's own embeds (world documents): no web page is ever loaded.
        validateEmbeddable={(link) => embedOf(link) !== null || isNoteLink(link)}
        // A document's link icon opens it, a note's writes in it (their links lead nowhere).
        onLinkOpen={(element, event) => {
          if (isNoteLink(element.link)) {
            event.preventDefault();
            startWriting(element.id);
            return;
          }
          const embed = embedOf(element.link);
          if (!embed) return;
          event.preventDefault();
          openDocument.current(embed.kind, embed.id);
        }}
        renderEmbeddable={(element) => {
          if (isNoteLink(element.link)) {
            return (
              <NoteView
                note={noteOf(element.customData)}
                editing={editingNote === element.id}
                onChange={(note) => writeNote(element.id, note)}
                onDone={stopWriting}
              />
            );
          }
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
            onNote={addNote}
            onNoteStyle={setNoteStyle}
          />
        </Footer>
      </Excalidraw>
      {drawing && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-md border-2 border-dashed border-primary"
          style={{
            left: drawing.x,
            top: drawing.y,
            width: drawing.width,
            height: drawing.height,
          }}
        />
      )}
      <span className="sr-only">{t("canvases.hint")}</span>
    </section>
  );
}
