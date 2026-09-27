import {
  Copy,
  LayoutGrid,
  Plus,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TypeProperties } from "@/features/properties";
import type { CanvasFormat, CardType, Orientation } from "@/lib/bindings";
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

/** Delay before a typed name is saved. */
const SAVE_DELAY_MS = 500;

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="text-sm font-bold">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Right side of the types screen: everything about one type or subtype. */
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
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const Icon = typeIcon(type.icon);

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
    <div className="flex min-h-0 flex-col gap-6 overflow-y-auto p-5">
      <header className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("cardTypes.chooseIcon")}
              className="size-10 shrink-0 rounded-lg border border-border"
            >
              <Icon style={{ color: typeColor(type.color) }} className="size-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="glass w-auto">
            <ChoiceTiles
              label={t("cardTypes.icon")}
              value={type.icon}
              onChange={(icon) => patch({ icon })}
              className="grid grid-cols-8 gap-1"
              tileClassName="size-9"
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
          className="h-10 font-heading text-lg font-bold"
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("cardTypes.duplicate")}
          title={t("cardTypes.duplicate")}
          disabled={duplicate.isPending}
          onClick={() =>
            duplicate.mutate(
              { id: type.id, name: t("cardTypes.copyName", { name: type.name }) },
              { onSuccess: (copy) => onSelect(copy.id) },
            )
          }
        >
          <Copy />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("cardTypes.delete")}
          title={t("cardTypes.delete")}
          onClick={() => setDeleting(true)}
          className="text-destructive"
        >
          <Trash2 />
        </Button>
      </header>

      {parent && (
        <p className="-mt-4 text-sm text-muted-foreground">
          {t("cardTypes.subtypeOf", { name: parent.name })}
        </p>
      )}
      {name.trim() === "" && (
        <p className="-mt-4 text-xs text-destructive">{t("cardTypes.nameRequired")}</p>
      )}
      {error && <AppErrorMessage error={error} />}

      <Section title={t("cardTypes.colorTitle")}>
        <ChoiceTiles
          label={t("cardTypes.colorTitle")}
          value={type.color}
          onChange={(color) => patch({ color })}
          tileClassName="size-8 rounded-full"
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
      </Section>

      {!parent && (
        <Section title={t("cardTypes.subtypes")}>
          {subtypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("cardTypes.noSubtypes")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {subtypes.map((sub) => (
                <li key={sub.id}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full"
                    onClick={() => onSelect(sub.id)}
                  >
                    {sub.name}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addSubtype} className="flex gap-2">
            <label htmlFor={subtypeId} className="sr-only">
              {t("cardTypes.newSubtype")}
            </label>
            <Input
              id={subtypeId}
              value={newSubtype}
              maxLength={80}
              placeholder={t("cardTypes.newSubtype")}
              onChange={(event) => setNewSubtype(event.target.value)}
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={newSubtype.trim() === "" || create.isPending}
            >
              <Plus />
              {t("cardTypes.addSubtype")}
            </Button>
          </form>
        </Section>
      )}

      <Section title={t("properties.title")}>
        {parent && (
          <p className="-mt-1 text-sm text-muted-foreground">
            {t("properties.inherits", { name: parent.name })}
          </p>
        )}
        <TypeProperties typeId={type.id} types={allTypes} />
      </Section>

      <Section title={t("templates.title")}>
        <p className="-mt-1 text-sm text-muted-foreground">{t("templates.hint")}</p>
        <TemplateEditor type={type} parent={parent} />
      </Section>

      <Section title={t("cardTypes.defaults")}>
        <p className="-mt-1 text-sm text-muted-foreground">{t("cardTypes.defaultsHint")}</p>
        <h4 className="text-xs font-bold text-muted-foreground">
          {t("cardTypes.orientationTitle")}
        </h4>
        <ChoiceTiles
          label={t("cardTypes.orientationTitle")}
          value={type.orientation}
          onChange={(orientation) => patch({ orientation })}
          className="grid grid-cols-2"
          tileClassName="flex-col gap-1 py-4 text-sm"
          choices={orientations.map(({ value, label, icon: TileIcon }) => ({
            value,
            label,
            content: (
              <>
                <TileIcon aria-hidden className="size-6" />
                <span>{label}</span>
              </>
            ),
          }))}
        />
        <h4 className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <LayoutGrid aria-hidden className="size-3.5" />
          {t("cardTypes.formatTitle")}
        </h4>
        <ChoiceTiles
          label={t("cardTypes.formatTitle")}
          value={type.canvasFormat}
          onChange={(canvasFormat) => patch({ canvasFormat })}
          className="grid grid-cols-4"
          tileClassName="flex-col gap-1 py-3 text-xs"
          choices={formats.map(({ value, label, icon: TileIcon }) => ({
            value,
            label,
            content: (
              <>
                <TileIcon aria-hidden className="size-5" />
                <span>{label}</span>
              </>
            ),
          }))}
        />
      </Section>

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
