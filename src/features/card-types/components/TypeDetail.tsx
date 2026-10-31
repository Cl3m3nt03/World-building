import {
  Copy,
  CornerLeftUp,
  LayoutGrid,
  Pencil,
  RectangleHorizontal,
  RectangleVertical,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TypeProperties } from "@/features/properties";
import type { CanvasFormat, CardType, Orientation } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { colorLabel, TYPE_COLORS, typeColor } from "../colors";
import {
  useCreateCardType,
  useDeleteCardType,
  useDuplicateCardType,
  useTypeCardCount,
  useUpdateCardType,
} from "../hooks/useCardTypes";
import { TYPE_ICON_NAMES, typeIcon } from "../icons";
import { ChoiceTiles } from "./ChoiceTiles";
import { TemplateEditor } from "./TemplateEditor";
import { TypeBadge } from "./TypeBadge";

/** Delay before a typed name is saved. */
const SAVE_DELAY_MS = 500;

/** A tile of the V2 choice groups (after the genres of « Create a world »). */
const TILE =
  "rounded-md border-border bg-(--bz-field) transition-[color,background-color,border-color,box-shadow] duration-(--bz-duration-fast) ease-atlas hover:border-[color-mix(in_oklab,var(--primary)_45%,var(--input))] hover:bg-(--bz-field) hover:text-foreground data-[state=checked]:bg-[color-mix(in_oklab,var(--primary)_12%,transparent)]";

type TypeDetailProps = {
  type: CardType;
  /** Subtypes of `type` (empty for a subtype). */
  subtypes: CardType[];
  /** The type `type` is a subtype of, if any. */
  parent: CardType | undefined;
  /** Every type and subtype, to choose where cards go when deleting. */
  allTypes: CardType[];
  onSelect: (id: string | null) => void;
};

/** A part of the type's sheet: its rubric on a fine line, like a card's section bars. */
function Section({
  title,
  hint,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  /** At the end of the bar: a setting of the whole section. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5">
      <div className="flex min-h-7 items-center gap-3">
        <h3 id={id} className="rubric shrink-0">
          {title}
        </h3>
        <span aria-hidden className="h-px flex-1 bg-border" />
        {aside}
      </div>
      {hint && <p className="-mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </section>
  );
}

/** An icon button with its name in a tooltip. */
function IconAction({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={className}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Right side of the types screen: the sheet of one type or subtype (V2-3.6). */
export function TypeDetail({ type, subtypes, parent, allTypes, onSelect }: TypeDetailProps) {
  const { t } = useTranslation();
  const update = useUpdateCardType();
  const duplicate = useDuplicateCardType();
  const create = useCreateCardType();
  const [name, setName] = useState(type.name);
  const [deleting, setDeleting] = useState(false);
  const [newSubtype, setNewSubtype] = useState("");
  const nameId = useId();
  const subtypeId = useId();
  const onCreateId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Another type selected, or the name changed elsewhere.
  useEffect(() => setName(type.name), [type.name]);

  const saveName = (value: string) => {
    clearTimeout(timer.current);
    const trimmed = value.trim();
    if (trimmed !== "" && trimmed !== type.name) {
      update.mutate({ id: type.id, patch: { name: trimmed } });
    }
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  const patch = (changes: Parameters<typeof update.mutate>[0]["patch"]) =>
    update.mutate({ id: type.id, patch: changes });

  const addSubtype = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = newSubtype.trim();
    if (trimmed === "") return;
    create.mutate(
      { parentId: type.id, name: trimmed, icon: type.icon, color: type.color },
      { onSuccess: () => setNewSubtype("") },
    );
  };

  const orientations: { value: Orientation; label: string; icon: typeof Square }[] = [
    { value: "portrait", label: t("cardTypes.orientation.portrait"), icon: RectangleVertical },
    { value: "landscape", label: t("cardTypes.orientation.landscape"), icon: RectangleHorizontal },
  ];
  const formats: { value: CanvasFormat; label: string; icon: typeof Square }[] = [
    { value: "compact", label: t("cardTypes.format.compact"), icon: Type },
    { value: "standard", label: t("cardTypes.format.standard"), icon: Square },
    { value: "tall", label: t("cardTypes.format.tall"), icon: RectangleVertical },
    { value: "wide", label: t("cardTypes.format.wide"), icon: RectangleHorizontal },
  ];
  const error = update.error ?? duplicate.error ?? create.error;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex items-start gap-4 pt-7 pr-14 pb-6 pl-8">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("cardTypes.chooseIcon")}
              title={t("cardTypes.chooseIcon")}
              className="group relative mt-1 shrink-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <TypeBadge
                type={type}
                size="lg"
                className="transition-transform duration-(--bz-duration-fast) ease-atlas group-hover:scale-[1.04]"
              />
              <span
                aria-hidden
                className="absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full glass-float text-muted-foreground group-hover:text-foreground"
              >
                <Pencil className="size-3" />
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            <p className="rubric px-1 pb-1.5">{t("cardTypes.icon")}</p>
            <ChoiceTiles
              label={t("cardTypes.icon")}
              value={type.icon}
              onChange={(icon) => patch({ icon })}
              className="grid grid-cols-8 gap-1"
              tileClassName="size-9 rounded-md border-transparent"
              choices={TYPE_ICON_NAMES.map((iconName) => {
                const Choice = typeIcon(iconName);
                return {
                  value: iconName,
                  label: iconName,
                  content: <Choice aria-hidden className="size-4" />,
                };
              })}
            />
          </PopoverContent>
        </Popover>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {parent && (
            <button
              type="button"
              onClick={() => onSelect(parent.id)}
              className="rubric flex items-center gap-1 self-start rounded-sm px-1 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <CornerLeftUp aria-hidden className="size-3.5" />
              {t("cardTypes.subtypeOf", { name: parent.name })}
            </button>
          )}
          <label htmlFor={nameId} className="sr-only">
            {t("cardTypes.name")}
          </label>
          <Input
            id={nameId}
            value={name}
            maxLength={80}
            onChange={(event) => {
              setName(event.target.value);
              clearTimeout(timer.current);
              const value = event.target.value;
              timer.current = setTimeout(() => saveName(value), SAVE_DELAY_MS);
            }}
            onBlur={() => saveName(name)}
            onKeyDown={(event) => {
              if (event.key === "Enter") saveName(name);
            }}
            aria-invalid={name.trim() === ""}
            className="h-auto border-transparent bg-transparent px-1 py-0.5 font-heading text-3xl font-bold shadow-none hover:border-border focus-visible:border-ring md:text-3xl dark:bg-transparent"
          />
          {name.trim() === "" && (
            <p className="px-1 text-xs text-destructive">{t("cardTypes.nameRequired")}</p>
          )}
          <ChoiceTiles
            label={t("cardTypes.colorTitle")}
            value={type.color}
            onChange={(color) => patch({ color })}
            className="gap-1 px-0.5 pt-1"
            tileClassName="size-7 rounded-full border-transparent hover:bg-muted data-[state=checked]:border-primary data-[state=checked]:bg-transparent"
            choices={TYPE_COLORS.map((color) => ({
              value: color,
              label: t(colorLabel(color)),
              content: (
                <span
                  aria-hidden
                  className="size-4 rounded-full"
                  style={{ background: typeColor(color) }}
                />
              ),
            }))}
          />
        </div>

        <div className="flex shrink-0 items-center gap-0.5 pt-1.5">
          <IconAction
            label={t("cardTypes.duplicate")}
            disabled={duplicate.isPending}
            onClick={() =>
              duplicate.mutate(
                { id: type.id, name: t("cardTypes.copyName", { name: type.name }) },
                { onSuccess: (copy) => onSelect(copy.id) },
              )
            }
          >
            <Copy />
          </IconAction>
          <IconAction
            label={t("cardTypes.delete")}
            onClick={() => setDeleting(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 />
          </IconAction>
        </div>
      </header>

      <div className="flex flex-col gap-7 px-8 pb-8">
        {error && <AppErrorMessage error={error} />}

        {!parent && (
          <Section title={t("cardTypes.subtypes")}>
            <div className="flex flex-wrap items-center gap-1.5">
              {subtypes.length === 0 && (
                <span className="pr-1 text-sm text-muted-foreground">
                  {t("cardTypes.noSubtypes")}
                </span>
              )}
              {subtypes.map((sub) => (
                <Button
                  key={sub.id}
                  variant="secondary"
                  size="sm"
                  className="h-7 gap-1.5 rounded-full pr-3 pl-0.5"
                  onClick={() => onSelect(sub.id)}
                >
                  <TypeBadge type={sub} size="sm" className="rounded-full" />
                  {sub.name}
                </Button>
              ))}
              <form onSubmit={addSubtype} className="flex items-center gap-1">
                <label htmlFor={subtypeId} className="sr-only">
                  {t("cardTypes.newSubtype")}
                </label>
                <input
                  id={subtypeId}
                  value={newSubtype}
                  maxLength={80}
                  placeholder={t("cardTypes.newSubtypeShort")}
                  onChange={(event) => setNewSubtype(event.target.value)}
                  // Stays wide while it holds a draft, like the aliases' field: a
                  // field shrinking on blur would slide « Add » from under the pointer.
                  className={cn(
                    "h-7 rounded-full border border-dashed border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-solid",
                    newSubtype === "" ? "w-40 focus:w-52" : "w-52",
                    "transition-[width,border-color] duration-(--bz-duration-fast) ease-atlas focus:border-ring focus-visible:ring-1 focus-visible:ring-ring/30",
                  )}
                />
                {newSubtype.trim() !== "" && (
                  <Button
                    type="submit"
                    variant="secondary"
                    size="xs"
                    className="rounded-full"
                    disabled={create.isPending}
                  >
                    {t("cardTypes.addSubtype")}
                  </Button>
                )}
              </form>
            </div>
          </Section>
        )}

        <Section
          title={t("cardTypes.propertiesTitle")}
          hint={
            parent ? t("properties.inherits", { name: parent.name }) : t("cardTypes.propertiesHint")
          }
        >
          <TypeProperties typeId={type.id} types={allTypes} />
        </Section>

        <Section title={t("templates.title")} hint={t("templates.hint")}>
          <div className="flex items-center gap-2.5 rounded-md bg-muted px-3 py-2">
            <Switch
              id={onCreateId}
              checked={type.templateOnCreate}
              onCheckedChange={(templateOnCreate) => patch({ templateOnCreate })}
            />
            <Label htmlFor={onCreateId} className="font-normal">
              {t("templates.onCreate")}
            </Label>
          </div>
          <TemplateEditor type={type} parent={parent} />
        </Section>

        <Section title={t("cardTypes.defaults")} hint={t("cardTypes.defaultsHint")}>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
            <div className="flex flex-col gap-1.5">
              <h4 className="text-xs font-medium text-muted-foreground">
                {t("cardTypes.orientationTitle")}
              </h4>
              <ChoiceTiles
                label={t("cardTypes.orientationTitle")}
                value={type.orientation}
                onChange={(orientation) => patch({ orientation })}
                className="grid grid-cols-2"
                tileClassName={cn(TILE, "flex-col gap-1 py-3 text-xs")}
                choices={orientations.map(({ value, label, icon: TileIcon }) => ({
                  value,
                  label,
                  content: (
                    <>
                      <TileIcon aria-hidden className="size-5" strokeWidth={1.5} />
                      <span>{label}</span>
                    </>
                  ),
                }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <h4 className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <LayoutGrid aria-hidden className="size-3.5" />
                {t("cardTypes.formatTitle")}
              </h4>
              <ChoiceTiles
                label={t("cardTypes.formatTitle")}
                value={type.canvasFormat}
                onChange={(canvasFormat) => patch({ canvasFormat })}
                className="grid grid-cols-4"
                tileClassName={cn(TILE, "flex-col gap-1 py-3 text-xs")}
                choices={formats.map(({ value, label, icon: TileIcon }) => ({
                  value,
                  label,
                  content: (
                    <>
                      <TileIcon aria-hidden className="size-5" strokeWidth={1.5} />
                      <span>{label}</span>
                    </>
                  ),
                }))}
              />
            </div>
          </div>
        </Section>
      </div>

      <DeleteTypeDialog
        type={deleting ? type : null}
        subtypeCount={subtypes.length}
        allTypes={allTypes}
        onClose={() => setDeleting(false)}
        onDeleted={() => onSelect(parent?.id ?? null)}
      />
    </div>
  );
}

function DeleteTypeDialog({
  type,
  subtypeCount,
  allTypes,
  onClose,
  onDeleted,
}: {
  type: CardType | null;
  subtypeCount: number;
  allTypes: CardType[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const remove = useDeleteCardType();
  const cardCount = useTypeCardCount(type?.id ?? null);
  const [destination, setDestination] = useState<string | null>(null);
  const destinationId = useId();
  const count = cardCount.data ?? 0;
  // Every other type or subtype, but not the ones being deleted.
  const candidates = allTypes.filter(
    (candidate) => type && candidate.id !== type.id && candidate.parentId !== type.id,
  );
  const label = (candidate: CardType) => {
    const owner = allTypes.find((other) => other.id === candidate.parentId);
    return owner ? `${owner.name} › ${candidate.name}` : candidate.name;
  };

  useEffect(() => {
    if (type) setDestination(null);
  }, [type]);

  return (
    <Dialog
      open={type !== null}
      onOpenChange={(open) => {
        if (!open) {
          remove.reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("cardTypes.deleteTitle", { name: type?.name ?? "" })}</DialogTitle>
          <DialogDescription>
            {subtypeCount > 0
              ? t("cardTypes.deleteWithSubtypes", { count: subtypeCount })
              : t("cardTypes.deleteDescription")}
          </DialogDescription>
        </DialogHeader>
        {count > 0 && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={destinationId} className="text-sm">
              {t("cardTypes.deleteCards", { count })}
            </label>
            <Select value={destination ?? ""} onValueChange={setDestination}>
              <SelectTrigger
                id={destinationId}
                className="w-full"
                aria-label={t("cardTypes.moveTo")}
              >
                <SelectValue placeholder={t("cardTypes.moveTo")} />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {label(candidate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {remove.isError && <AppErrorMessage error={remove.error} />}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("createWorld.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending || cardCount.isPending || (count > 0 && !destination)}
            onClick={() => {
              if (!type) return;
              remove.mutate(
                { id: type.id, moveCardsTo: count > 0 ? destination : null },
                {
                  onSuccess: () => {
                    onClose();
                    onDeleted();
                  },
                },
              );
            }}
          >
            {t("cardTypes.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
