import { Save } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * « Save as… » of the graph's bar (docs/features/04-graph.md): a new graph,
 * named, with the current configuration (filters, settings, pinned nodes,
 * framing); it opens and shows in the sidebar. The graph itself keeps
 * saving on its own.
 */
export function SaveGraphAs({
  onSave,
  pending,
  error,
}: {
  onSave: (title: string) => Promise<unknown>;
  pending: boolean;
  error: unknown;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    if (name === "") return;
    void onSave(name).then(() => {
      setOpen(false);
      setTitle("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("graphs.saveAs.button")}
          title={t("graphs.saveAs.button")}
        >
          <Save />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("graphs.saveAs.title")}</DialogTitle>
            <DialogDescription>{t("graphs.saveAs.description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-name`}>{t("graphs.saveAs.name")}</Label>
            <Input
              id={`${id}-name`}
              autoFocus
              value={title}
              maxLength={200}
              placeholder={t("graphs.saveAs.placeholder")}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          {error ? <AppErrorMessage error={error} /> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending || title.trim() === ""}>
              {t("graphs.saveAs.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
