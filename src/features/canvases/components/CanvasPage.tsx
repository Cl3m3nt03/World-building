import { useNavigate, useParams } from "@tanstack/react-router";
import { Maximize } from "lucide-react";
import { lazy, Suspense, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { DocumentTitleField } from "@/components/DocumentTitleField";
import { Button } from "@/components/ui/button";
import { useMarkOpened } from "@/features/cards/hooks/useCards";
import type { Canvas } from "@/lib/bindings";
import { documentRoute } from "@/lib/documentRoute";
import { useCanvasEditor } from "../hooks/useCanvasEditor";
import { useCanvas, useRenameCanvas } from "../hooks/useCanvases";
import type { CanvasViewHandle } from "./CanvasView";

// Excalidraw is big: loaded when a canvas opens, not with the app.
const CanvasView = lazy(() => import("./CanvasView"));

function TitleField({ canvas }: { canvas: Canvas }) {
  const { t } = useTranslation();
  const rename = useRenameCanvas(canvas.id);
  return <DocumentTitleField title={canvas.title} label={t("canvases.title")} rename={rename} />;
}

/** A canvas, opened in the World tab (M7). */
export function CanvasPage() {
  const { canvasId } = useParams({ from: "/world/$worldId/world/canvas/$canvasId" });
  const canvas = useCanvas(canvasId);
  useMarkOpened(canvasId);
  if (canvas.error) {
    return (
      <div className="p-6">
        <AppErrorMessage error={canvas.error} />
      </div>
    );
  }
  if (!canvas.data) return null;
  // Remounted for another canvas: the editor starts from that canvas's scene.
  return <CanvasEditor key={canvas.data.id} canvas={canvas.data} />;
}

function CanvasEditor({ canvas }: { canvas: Canvas }) {
  const { t } = useTranslation();
  const view = useRef<CanvasViewHandle>(null);
  const editor = useCanvasEditor(canvas);
  const navigate = useNavigate();
  const { worldId } = useParams({ from: "/world/$worldId/world/canvas/$canvasId" });
  return (
    <article
      aria-label={canvas.title}
      className="glass flex h-full min-w-0 flex-col gap-3 overflow-hidden rounded-lg p-3"
    >
      <header className="flex flex-wrap items-center gap-2">
        <TitleField canvas={canvas} />
        <Button variant="secondary" size="sm" onClick={() => view.current?.recenter()}>
          <Maximize />
          {t("canvases.recenter")}
        </Button>
      </header>
      {editor.error ? <AppErrorMessage error={editor.error} /> : null}
      {/* Excalidraw fills this box and must not overflow it. */}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <Suspense
          fallback={<p className="p-6 text-sm text-muted-foreground">{t("canvases.loading")}</p>}
        >
          <CanvasView
            ref={view}
            canvas={canvas}
            label={t("canvases.viewLabel", { name: canvas.title })}
            onChange={editor.onChange}
            onOpenCard={(cardId) => void navigate(documentRoute(worldId, "card", cardId))}
          />
        </Suspense>
      </div>
      <p className="text-xs text-muted-foreground">{t("canvases.navigationHint")}</p>
    </article>
  );
}
