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
  BinaryFileData,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { useQueryClient } from "@tanstack/react-query";
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
import { ImagePickerDialog, mediaKeys } from "@/features/media";
import { type Canvas, commands } from "@/lib/bindings";
import { CARD_DROP_EVENT, type CardDropDetail } from "@/lib/cardDrop";
import { unwrap } from "@/lib/ipc";
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
import { missingFiles, naturalSize, placedSize, readAsset } from "../images";
import { isNoteLink, NEW_NOTE, NOTE_LINK, NOTE_SIZE, type Note, noteOf } from "../notes";
import {
  type FrameLike,
  frameAround,
  insertionIndex,
  sectionName,
  unnamedFrames,
} from "../sections";
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

/** An image's bytes as Excalidraw keeps them (its ids and types are branded strings). */
function fileData(id: string, dataURL: string, mimeType: string): BinaryFileData {
  return { id, dataURL, mimeType, created: Date.now() } as unknown as BinaryFileData;
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
  const queryClient = useQueryClient();
  const [pickingImage, setPickingImage] = useState(false);
  // Images whose bytes are being read from the media library.
  const loading = useRef(new Set<string>());
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

  /**
   * A new section is named « Section 3 » (Excalidraw would say « Frame »),
   * once drawn; outside the history (undoing the section undoes its name).
   */
  const nameSections = (elements: readonly ExcalidrawElement[], state: AppState) => {
    if (state.newElement) return;
    const unnamed = new Set(unnamedFrames(elements as unknown as FrameLike[]));
    if (unnamed.size === 0) return;
    const names = elements
      .filter((element) => element.type === "frame" && !element.isDeleted)
      .map((element) => (element as { name?: string | null }).name ?? null);
    const excalidraw = api.current;
    if (!excalidraw) return;
    excalidraw.updateScene({
      elements: excalidraw.getSceneElementsIncludingDeleted().map((element) => {
        if (!unnamed.has(element.id)) return element;
        const name = sectionName(t("canvases.sections.name"), names);
        names.push(name);
        // biome-ignore lint/suspicious/noExplicitAny: a frame's name
        return newElementWith(element, { name } as any);
      }),
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  };

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
        // A text bound to a removed shape goes with it, what a removed section holds too.
        selected.has(element.id) ||
        ("containerId" in element && element.containerId && selected.has(element.containerId)) ||
        (element.frameId && selected.has(element.frameId))
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

  /**
   * Adds an element BuilderZ builds (a document, a note, a cloud…), selected:
   * in the section that holds it, if any, as Excalidraw does for its own.
   * Gives its id.
   */
  const addElement = useCallback((fields: Record<string, unknown> & { type: string }) => {
    const excalidraw = api.current;
    if (!excalidraw) return null;
    const all = excalidraw.getSceneElementsIncludingDeleted();
    const frameId = frameAround(
      all as unknown as FrameLike[],
      fields as unknown as { x: number; y: number; width: number; height: number },
    );
    // Excalidraw builds the element from its main fields (defaults for the rest).
    const [element] = restoreElements(
      // biome-ignore lint/suspicious/noExplicitAny: Excalidraw restores what it reads
      [{ id: crypto.randomUUID(), ...fields, frameId } as any],
      null,
    );
    if (!element) return null;
    const at = insertionIndex(all, frameId);
    // Back to selecting first: the change of tool is then part of the same
    // undo step (after, it would be a step of its own, undoing nothing seen).
    excalidraw.setActiveTool({ type: "selection" });
    excalidraw.updateScene({
      elements: [...all.slice(0, at), element, ...all.slice(at)],
      appState: { selectedElementIds: { [element.id]: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    return element.id;
  }, []);

  /** Adds one of BuilderZ's embeddables (a document, a note), selected; gives its id. */
  const addEmbeddable = useCallback(
    (fields: {
      x: number;
      y: number;
      width: number;
      height: number;
      link: string;
      customData?: Record<string, unknown>;
    }) =>
      addElement({
        type: "embeddable",
        ...fields,
        strokeColor: "transparent",
        backgroundColor: "transparent",
        roundness: null,
      }),
    [addElement],
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
    editing.current = id;
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

  /**
   * What was written in a note (after a pause, or at the end): a step to
   * undo. Excalidraw leaves out of its steps an element changed without
   * one, so each piece of writing is a change of its own.
   */
  const writeNote = useCallback((id: string, note: Note) => {
    const excalidraw = api.current;
    const element = excalidraw?.getSceneElementsIncludingDeleted().find((each) => each.id === id);
    if (!excalidraw || !element) return;
    const next = newElementWith(element, {
      customData: { ...noteOf(element.customData), ...note },
    });
    // Still written in: Excalidraw keeps the pointer in it.
    const active =
      editing.current === id
        ? // biome-ignore lint/suspicious/noExplicitAny: Excalidraw's own embeddable type
          { activeEmbeddable: { element: next as any, state: "active" as const } }
        : null;
    excalidraw.updateScene({
      elements: excalidraw
        .getSceneElementsIncludingDeleted()
        .map((each) => (each.id === id ? next : each)),
      appState: active,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, []);

  const stopWriting = useCallback(() => {
    if (editing.current === null) return;
    // Once only: Escape, the field's blur and Excalidraw's change all end it.
    editing.current = null;
    setEditingNote(null);
    // The note keeps the rest of what was written itself (NoteView), once
    // no longer written in.
    api.current?.updateScene({
      appState: { activeEmbeddable: null },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
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
      addElement({
        type: "line",
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
      });
    });
    return () => {
      offDown();
      offUp();
      window.removeEventListener("pointermove", track);
    };
  }, [ready, addElement]);

  // --- Images ----------------------------------------------------------------
  /** Gives Excalidraw the bytes of the images it shows, read from the media library. */
  const loadImages = useCallback((elements: readonly ExcalidrawElement[]) => {
    const excalidraw = api.current;
    if (!excalidraw) return;
    const known = new Set([...Object.keys(excalidraw.getFiles()), ...loading.current]);
    for (const id of missingFiles(elements as unknown as { type: string }[], known)) {
      loading.current.add(id);
      readAsset(id)
        .then(({ dataURL, mimeType }) => excalidraw.addFiles([fileData(id, dataURL, mimeType)]))
        // An asset deleted from the media library: Excalidraw shows its empty image.
        .catch(() => undefined)
        .finally(() => loading.current.delete(id));
    }
  }, []);

  /**
   * An image pasted (Ctrl+V) or dropped from the PC: imported into the
   * world's media library first; its asset id becomes the element's file id.
   */
  const importImage = useCallback(
    async (file: File) => {
      const data = Array.from(new Uint8Array(await file.arrayBuffer()));
      const { asset } = await unwrap(commands.importAssetData(file.name || "image", data));
      void queryClient.invalidateQueries({ queryKey: mediaKeys.all() });
      return asset.id;
    },
    [queryClient],
  );

  /** An image of the media library, placed in the middle of the view at its size. */
  const placeImage = useCallback(
    async (assetId: string) => {
      const excalidraw = api.current;
      const point = viewCentre();
      if (!excalidraw || !point) return;
      const { dataURL, mimeType } = await readAsset(assetId);
      excalidraw.addFiles([fileData(assetId, dataURL, mimeType)]);
      const natural = await naturalSize(dataURL);
      const size = placedSize(natural.width, natural.height);
      addElement({
        type: "image",
        fileId: assetId,
        status: "saved",
        scale: [1, 1],
        x: point.x - size.width / 2,
        y: point.y - size.height / 2,
        ...size,
      });
      section.current?.querySelector<HTMLElement>(".excalidraw")?.focus();
    },
    [addElement, viewCentre],
  );

  // The images of the scene as it opens.
  useEffect(() => {
    if (ready && api.current) loadImages(api.current.getSceneElements());
  }, [ready, loadImages]);

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
          // Builds for the end-to-end tests read the scene as Excalidraw holds it.
          if (import.meta.env.VITE_E2E === "1") {
            (window as unknown as { __bzExcalidraw?: unknown }).__bzExcalidraw = instance;
          }
        }}
        theme={theme}
        langCode={i18n.language.startsWith("fr") ? "fr-FR" : "en"}
        onChange={(elements, appState) => {
          onChange(
            elements as unknown as readonly SceneElement[],
            getSceneVersion(elements),
            appState as unknown as KeptState,
          );
          nameSections(elements, appState);
          loadImages(elements);
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
        generateIdForFile={importImage}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            toggleTheme: false,
            changeViewBackgroundColor: false,
          },
          // Kept on: Excalidraw takes pasted and dropped images only with it.
          // Its button is hidden with its toolbar; ours opens the media library.
          tools: { image: true },
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
            onImages={() => setPickingImage(true)}
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
      <ImagePickerDialog
        open={pickingImage}
        onOpenChange={setPickingImage}
        title={t("canvases.images.pick")}
        onPick={(assetId) => void placeImage(assetId)}
      />
      <span className="sr-only">{t("canvases.hint")}</span>
    </section>
  );
}
