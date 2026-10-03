import "@excalidraw/excalidraw/index.css";
import {
  CaptureUpdateAction,
  Excalidraw,
  Footer,
  getSceneVersion,
  MainMenu,
  newElementWith,
  restoreElements,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { type Ref, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useResolvedTheme } from "@/app/theme";
import type { Canvas } from "@/lib/bindings";
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

export type CanvasViewHandle = {
  /** Frames every element. */
  recenter: () => void;
};

type Props = {
  canvas: Canvas;
  /** Accessible name of the drawing area. */
  label: string;
  onChange: (elements: readonly SceneElement[], version: number, view: KeptState) => void;
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
export default function CanvasView({ canvas, label, onChange, ref }: Props) {
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
          />
        </Footer>
      </Excalidraw>
      <span className="sr-only">{t("canvases.hint")}</span>
    </section>
  );
}
