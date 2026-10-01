import { FileText, Folder, Home } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type Destination, moveDestinations, type TreeNode } from "../tree";

type Props = {
  /** The document to move, or `null` when the dialog is closed. */
  node: (TreeNode & { kind: "document" }) | null;
  roots: TreeNode[];
  onPick: (destination: Destination) => void;
  onClose: () => void;
};

/** Lower case without accents, to match "elfe" with "Elfé". */
function fold(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * "Move to…": picks the root, a folder or a parent document for a document,
 * with the keyboard (type to filter, arrows, Enter). Its own descendants are
 * not offered (no cycle); its current place is shown, not offered.
 */
export function MoveToDialog({ node, roots, onPick, onClose }: Props) {
  const { t } = useTranslation();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const all = useMemo(() => (node ? moveDestinations(roots, node.key) : []), [roots, node]);
  const shown = useMemo(() => {
    const wanted = fold(query.trim());
    return all.filter(
      (destination) =>
        !destination.current &&
        (wanted === "" || fold(destination.label || t("sidebar.move.root")).includes(wanted)),
    );
  }, [all, query, t]);
  const activeIndex = Math.min(active, shown.length - 1);
  const close = () => {
    setQuery("");
    setActive(0);
    onClose();
  };
  const pick = (destination: Destination | undefined) => {
    if (!destination) return;
    onPick(destination);
    close();
  };
  const optionId = (index: number) => `${listId}-${index}`;
  const here = all.find((destination) => destination.current);

  return (
    <Dialog open={node !== null} onOpenChange={(open) => !open && close()}>
      {node && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("sidebar.move.title", { name: node.document.title })}</DialogTitle>
            <DialogDescription>
              {t("sidebar.move.description", {
                place: here?.label
                  ? [...here.path, here.label].join(" › ")
                  : t("sidebar.move.root"),
              })}
            </DialogDescription>
          </DialogHeader>
          <Input
            role="combobox"
            aria-label={t("sidebar.move.filter")}
            aria-controls={listId}
            aria-expanded
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            placeholder={t("sidebar.move.filter")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") setActive(Math.min(activeIndex + 1, shown.length - 1));
              else if (event.key === "ArrowUp") setActive(Math.max(activeIndex - 1, 0));
              else if (event.key === "Home") setActive(0);
              else if (event.key === "End") setActive(shown.length - 1);
              else if (event.key === "Enter") pick(shown[activeIndex]);
              else return;
              event.preventDefault();
            }}
          />
          <div
            id={listId}
            role="listbox"
            aria-label={t("sidebar.move.destinations")}
            className="scrollbar-thin flex max-h-72 flex-col overflow-y-auto"
          >
            {shown.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                {t("sidebar.move.none")}
              </p>
            )}
            {shown.map((destination, index) => {
              const Icon =
                destination.kind === "root"
                  ? Home
                  : destination.kind === "folder"
                    ? Folder
                    : FileText;
              const filtering = query.trim() !== "";
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox above handles the keys (aria-activedescendant).
                <div
                  key={destination.key}
                  id={optionId(index)}
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === activeIndex}
                  onMouseMove={() => setActive(index)}
                  onClick={() => pick(destination)}
                  className={cn(
                    "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    index === activeIndex && "bg-accent text-accent-foreground",
                  )}
                  style={{
                    paddingLeft: filtering ? undefined : 8 + destination.path.length * 16,
                  }}
                >
                  <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {destination.kind === "root" ? t("sidebar.move.root") : destination.label}
                  </span>
                  {filtering && destination.path.length > 0 && (
                    <span className="truncate text-xs text-muted-foreground">
                      {destination.path.join(" › ")}
                    </span>
                  )}
                  {destination.kind === "document" && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {t("sidebar.move.asChild")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
