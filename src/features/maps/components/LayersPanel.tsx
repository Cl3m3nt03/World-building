import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { MapContent, MapLayer } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import {
  addLayer,
  layerItemCount,
  moveLayer,
  neighbourLayer,
  removeLayer,
  renameLayer,
  setLayerVisible,
} from "../layers";

type LayersPanelProps = {
  content: MapContent;
  update: (change: (previous: MapContent) => MapContent) => void;
  activeLayerId: string;
  onActiveLayerChange: (id: string) => void;
};

/**
 * The layers of a map (M4 step 4.4), top layer first: an eye to hide or
 * show each one, the active layer (which receives new pins, zones and
 * texts) chosen by a click; rename, move up / down (also Alt+↑ / Alt+↓)
 * and delete from its menu.
 */
export function LayersPanel({
  content,
  update,
  activeLayerId,
  onActiveLayerChange,
}: LayersPanelProps) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  // Set when « Rename » closed a layer's menu: the field takes the focus then.
  const renamedFromMenu = useRef(false);
  const [deleting, setDeleting] = useState<MapLayer | null>(null);
  // Top layer first, as it is drawn over the others.
  const listed = [...content.layers].reverse();
  const count = content.layers.length;

  const add = () => {
    const id = crypto.randomUUID();
    update((previous) =>
      addLayer(previous, {
        id,
        name: t("maps.layers.newName", { index: previous.layers.length + 1 }),
      }),
    );
    onActiveLayerChange(id);
    setRenaming(id);
  };
  /** Moves a layer one step up (+1, drawn later) or down (-1). */
  const shift = (layer: MapLayer, step: 1 | -1) =>
    update((previous) =>
      moveLayer(
        previous,
        layer.id,
        previous.layers.findIndex((other) => other.id === layer.id) + step,
      ),
    );
  const onKeyDown = (event: KeyboardEvent, layer: MapLayer) => {
    if (event.altKey && event.key === "ArrowUp") {
      event.preventDefault();
      shift(layer, 1);
    } else if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault();
      shift(layer, -1);
    } else if (event.key === "F2") {
      event.preventDefault();
      setRenaming(layer.id);
    }
  };

  return (
    <section ref={panel} aria-labelledby="map-layers-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="map-layers-title" className="flex items-center gap-1.5 text-sm font-medium">
          <Layers aria-hidden className="size-4" />
          {t("maps.layers.title")}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("maps.layers.add")}
          title={t("maps.layers.add")}
          onClick={add}
        >
          <Plus />
        </Button>
      </div>
      <ul aria-label={t("maps.layers.title")} className="flex flex-col gap-0.5">
        {listed.map((layer) => {
          const index = content.layers.indexOf(layer);
          const active = layer.id === activeLayerId;
          return (
            <li
              key={layer.id}
              className={cn(
                "group flex items-center gap-1 rounded-md pr-1",
                active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t(layer.visible ? "maps.layers.hide" : "maps.layers.show", {
                  name: layer.name,
                })}
                aria-pressed={!layer.visible}
                onClick={() =>
                  update((previous) => setLayerVisible(previous, layer.id, !layer.visible))
                }
              >
                {layer.visible ? <Eye /> : <EyeOff className="text-muted-foreground" />}
              </Button>
              {renaming === layer.id ? (
                <RenameField
                  layer={layer}
                  onDone={(name) => {
                    if (name !== null) update((previous) => renameLayer(previous, layer.id, name));
                    setRenaming(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown F2"
                  onClick={() => onActiveLayerChange(layer.id)}
                  onDoubleClick={() => setRenaming(layer.id)}
                  onKeyDown={(event) => onKeyDown(event, layer)}
                  className={cn(
                    "min-w-0 flex-1 truncate rounded-sm px-1 py-1 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    !layer.visible && "text-muted-foreground",
                  )}
                >
                  {layer.name}
                </button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("maps.layers.actions", { name: layer.name })}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  // The menu would give the focus back to its button, which
                  // would end the rename at once (the field blurs).
                  onCloseAutoFocus={(event) => {
                    if (!renamedFromMenu.current) return;
                    renamedFromMenu.current = false;
                    event.preventDefault();
                    panel.current
                      ?.querySelector<HTMLInputElement>(
                        `input[aria-label="${t("maps.layers.nameLabel")}"]`,
                      )
                      ?.focus();
                  }}
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      renamedFromMenu.current = true;
                      setRenaming(layer.id);
                    }}
                  >
                    <Pencil />
                    {t("maps.layers.rename")}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={index === count - 1} onSelect={() => shift(layer, 1)}>
                    <ArrowUp />
                    {t("maps.layers.up")}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={index === 0} onSelect={() => shift(layer, -1)}>
                    <ArrowDown />
                    {t("maps.layers.down")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={count === 1}
                    onSelect={() => {
                      if (layerItemCount(content, layer.id) === 0) {
                        update((previous) => removeLayer(previous, layer.id, "delete"));
                      } else {
                        setDeleting(layer);
                      }
                    }}
                  >
                    <Trash2 />
                    {t("maps.layers.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>
      <DeleteLayerDialog
        content={content}
        layer={deleting}
        onClose={() => setDeleting(null)}
        onDelete={(keep) => {
          if (deleting) update((previous) => removeLayer(previous, deleting.id, keep));
          setDeleting(null);
        }}
      />
    </section>
  );
}

/** The layer's name, edited in place: Enter or leaving saves, Escape cancels. */
function RenameField({
  layer,
  onDone,
}: {
  layer: MapLayer;
  onDone: (name: string | null) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(layer.name);
  const finish = () => onDone(name.trim() === "" ? null : name.trim());
  return (
    <Input
      autoFocus
      aria-label={t("maps.layers.nameLabel")}
      value={name}
      maxLength={200}
      onFocus={(event) => event.target.select()}
      onChange={(event) => setName(event.target.value)}
      onBlur={finish}
      onKeyDown={(event) => {
        if (event.key === "Enter") finish();
        if (event.key === "Escape") onDone(null);
      }}
      className="h-7 min-w-0 flex-1 px-1 text-sm"
    />
  );
}

/** Deleting a layer that holds something: move it to the neighbour layer, or delete it too. */
function DeleteLayerDialog({
  content,
  layer,
  onClose,
  onDelete,
}: {
  content: MapContent;
  layer: MapLayer | null;
  onClose: () => void;
  onDelete: (keep: "move" | "delete") => void;
}) {
  const { t } = useTranslation();
  const neighbour = layer ? neighbourLayer(content, layer.id) : undefined;
  return (
    <Dialog open={layer !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("maps.layers.deleteTitle", { name: layer?.name ?? "" })}</DialogTitle>
          <DialogDescription>
            {t("maps.layers.deleteDescription", {
              count: layer ? layerItemCount(content, layer.id) : 0,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose}>
            {t("createWorld.cancel")}
          </Button>
          <Button variant="secondary" onClick={() => onDelete("move")}>
            {t("maps.layers.deleteMove", { name: neighbour?.name ?? "" })}
          </Button>
          <Button variant="destructive" onClick={() => onDelete("delete")}>
            {t("maps.layers.deleteAll")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
