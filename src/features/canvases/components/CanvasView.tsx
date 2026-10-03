import "@excalidraw/excalidraw/index.css";
import { Excalidraw, getSceneVersion, MainMenu, restoreElements } from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { type Ref, useImperativeHandle, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useResolvedTheme } from "@/app/theme";
import type { Canvas } from "@/lib/bindings";
import type { KeptState, SceneElement } from "../hooks/useCanvasEditor";

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
    appState: (framed ? state : {}) as NonNullable<ExcalidrawInitialDataState["appState"]>,
    scrollToContent: !framed,
  };
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
    <section aria-label={label} className="bz-canvas size-full overflow-hidden rounded-lg">
      <Excalidraw
        initialData={data}
        excalidrawAPI={(instance) => {
          api.current = instance;
        }}
        theme={theme}
        langCode={i18n.language.startsWith("fr") ? "fr-FR" : "en"}
        onChange={(elements, appState) =>
          onChange(
            elements as unknown as readonly SceneElement[],
            getSceneVersion(elements),
            appState as unknown as KeptState,
          )
        }
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            toggleTheme: false,
            changeViewBackgroundColor: false,
          },
        }}
      >
        {/* Only what makes sense in BuilderZ (no file, no link to excalidraw.com). */}
        <MainMenu>
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.DefaultItems.Help />
        </MainMenu>
      </Excalidraw>
      <span className="sr-only">{t("canvases.hint")}</span>
    </section>
  );
}
