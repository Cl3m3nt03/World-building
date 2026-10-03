import { CheckCircle2, Download, FolderOpen } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TYPE_COLORS } from "@/features/card-types";
import { useCurrentWorld } from "@/features/world";
import { commands } from "@/lib/bindings";
import { openDialog } from "@/lib/dialogs";
import { unwrap } from "@/lib/ipc";
import { type ExportProgress, exportWiki } from "../export/exportWiki";
import { WIKI_BUTTON } from "./styles";

type State =
  | { kind: "idle" }
  | { kind: "running"; progress: ExportProgress | null }
  | { kind: "done"; dir: string }
  | { kind: "failed"; error: unknown };

/** The card-type colours as the wiki shows them now (its light or dark set). */
function typeColors(): Record<string, string> {
  const root = document.querySelector("[data-wiki]");
  if (!root) return {};
  const style = getComputedStyle(root);
  return Object.fromEntries(
    TYPE_COLORS.map((color) => {
      const name = `--bz-type-${color}`;
      return [name, style.getPropertyValue(name).trim()];
    }).filter(([, value]) => value !== ""),
  );
}

/**
 * « Exporter le wiki »: a folder is chosen, the site is written in a folder
 * named after the wiki in it, with a progress bar; at the end, the folder can
 * be opened.
 */
export function ExportDialog() {
  const { t, i18n } = useTranslation();
  const { data: world } = useCurrentWorld();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const running = state.kind === "running";

  const start = async () => {
    const parent = await openDialog({ directory: true, title: t("wiki.export.pickFolder") });
    if (typeof parent !== "string") return;
    setState({ kind: "running", progress: null });
    try {
      const dir = await exportWiki({
        parent,
        worldName: world?.name ?? "",
        t,
        language: i18n.language,
        typeColors: typeColors(),
        onProgress: (progress) => setState({ kind: "running", progress }),
      });
      setState({ kind: "done", dir });
    } catch (error) {
      setState({ kind: "failed", error });
    }
  };

  const progress = state.kind === "running" ? state.progress : null;
  const percent =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <>
      <button type="button" className={WIKI_BUTTON} onClick={() => setOpen(true)}>
        <Download aria-hidden />
        {t("wiki.export.open")}
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          // The export cannot be left halfway.
          if (running) return;
          setOpen(next);
          if (!next) setState({ kind: "idle" });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("wiki.export.title")}</DialogTitle>
            <DialogDescription>{t("wiki.export.description")}</DialogDescription>
          </DialogHeader>
          {state.kind === "running" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm" aria-live="polite">
                {t(`wiki.export.step.${progress?.step ?? "read"}`, {
                  done: progress?.done ?? 0,
                  total: progress?.total ?? 0,
                })}
              </p>
              <div
                role="progressbar"
                aria-label={t("wiki.export.progress")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
          {state.kind === "done" && (
            <p className="flex items-start gap-2 text-sm" role="status">
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                {t("wiki.export.done")} <code className="break-all">{state.dir}</code>
              </span>
            </p>
          )}
          {state.kind === "failed" && <AppErrorMessage error={state.error} />}
          <DialogFooter>
            {state.kind === "done" ? (
              <Button onClick={() => void unwrap(commands.revealInExplorer(state.dir))}>
                <FolderOpen />
                {t("wiki.export.openFolder")}
              </Button>
            ) : (
              <Button onClick={() => void start()} disabled={running}>
                <Download />
                {t("wiki.export.choose")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
