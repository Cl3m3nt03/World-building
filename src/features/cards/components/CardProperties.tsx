import { Link as RouterLink } from "@tanstack/react-router";
import { Plus, Settings2, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import {
  PropertyEditor,
  useCardProperties,
  useCreateProperty,
  useSetPropertyValue,
} from "@/features/properties";
import type { CardProperty, PropertyValue } from "@/lib/bindings";
import { type DocumentLink, useDocumentLink } from "@/lib/documentLinks";
import { usePendingSave } from "@/lib/pendingSaves";
import { useCardList } from "../hooks/useCards";
import { CardPicker } from "./CardPicker";

/** Delay before a typed value is saved. */
const SAVE_DELAY_MS = 500;

function toText(value: PropertyValue | null): string {
  if (!value) return "";
  if (value.kind === "text") return value.value;
  if (value.kind === "number") return value.value === null ? "" : String(value.value);
  return "";
}

/** The value a text field holds, for a property of `kind` (`null`: empty or unreadable). */
function fromText(kind: CardProperty["definition"]["kind"], text: string): PropertyValue | null {
  if (text.trim() === "") return null;
  if (kind === "number") {
    const number = Number(text.replace(",", "."));
    return Number.isFinite(number) ? { kind: "number", value: number } : null;
  }
  return { kind: "text", value: text };
}

/** Cards a link value points to. */
function linkedIds(value: PropertyValue | null): string[] {
  if (value?.kind === "card") return [value.value];
  if (value?.kind === "cards") return value.value;
  return [];
}

/** A linked card: a link to its page, or its name only (`link` is `null`). */
function LinkedCard({
  link,
  title,
  icon,
}: {
  link: DocumentLink | null;
  title: string;
  icon: ReactNode;
}) {
  if (!link) {
    return (
      <span className="flex items-center gap-1.5">
        {icon}
        {title}
      </span>
    );
  }
  return (
    <RouterLink
      {...link}
      className="flex items-center gap-1.5 rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {icon}
      {title}
    </RouterLink>
  );
}

type FieldProps = { cardId: string; property: CardProperty; inputId: string };

function TextValue({ cardId, property, inputId }: FieldProps) {
  const { t } = useTranslation();
  const setValue = useSetPropertyValue(cardId);
  const saved = toText(property.value);
  const [text, setText] = useState(saved);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { definition } = property;
  const invalid =
    definition.kind === "number" && text.trim() !== "" && fromText("number", text) === null;

  useEffect(() => setText(saved), [saved]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Returns the save, awaited before the world or the window closes.
  const save = (value: string) => {
    clearTimeout(timer.current);
    if (value === saved) return undefined;
    if (definition.kind === "number" && value.trim() !== "" && fromText("number", value) === null) {
      return undefined;
    }
    // A failure is shown under the field (`setValue.error`).
    return setValue
      .mutateAsync({ propertyId: definition.id, value: fromText(definition.kind, value) })
      .catch(() => {});
  };
  usePendingSave(() => save(text));

  return (
    <div className="flex flex-col gap-1">
      <Input
        id={inputId}
        aria-label={definition.label}
        value={text}
        inputMode={definition.kind === "number" ? "decimal" : undefined}
        aria-invalid={invalid}
        onChange={(event) => {
          const value = event.target.value;
          setText(value);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => save(value), SAVE_DELAY_MS);
        }}
        onBlur={() => void save(text)}
      />
      {invalid && <p className="text-xs text-destructive">{t("properties.notANumber")}</p>}
      {setValue.isError && <AppErrorMessage error={setValue.error} />}
    </div>
  );
}

/** Link values as chips (each opens its card), with a picker to add or change. */
function LinkValue({ cardId, property }: FieldProps) {
  const { t } = useTranslation();
  const linkOf = useDocumentLink();
  const setValue = useSetPropertyValue(cardId);
  const cards = useCardList(false);
  const types = useCardTypes();
  const { definition } = property;
  const multiple = definition.kind === "cards";
  const ids = linkedIds(property.value);

  const save = (next: string[]) =>
    setValue.mutate({
      propertyId: definition.id,
      value:
        next.length === 0
          ? null
          : multiple
            ? { kind: "cards", value: next }
            : { kind: "card", value: next[0] as string },
    });

  return (
    <div className="flex flex-col gap-1">
      <ul aria-label={definition.label} className="flex flex-wrap items-center gap-1.5">
        {ids.map((id) => {
          const target = cards.data?.find((card) => card.id === id);
          const type = types.data?.find((candidate) => candidate.id === target?.typeId);
          const Icon = typeIcon(type?.icon ?? "shapes");
          return (
            <li
              key={id}
              className="flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-0.5 pl-2.5 text-sm"
            >
              {target ? (
                <LinkedCard
                  link={linkOf("card", id)}
                  title={target.title}
                  icon={
                    <Icon
                      aria-hidden
                      className="size-3.5"
                      style={{ color: typeColor(type?.color ?? "slate") }}
                    />
                  }
                />
              ) : (
                <span className="text-muted-foreground italic">{t("properties.missingCard")}</span>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                className="rounded-full"
                aria-label={t("properties.removeLink", {
                  name: target?.title ?? t("properties.missingCard"),
                })}
                onClick={() => save(ids.filter((other) => other !== id))}
              >
                <X />
              </Button>
            </li>
          );
        })}
        {(multiple || ids.length === 0) && (
          <li>
            <CardPicker
              label={t("properties.pickFor", { name: definition.label })}
              allowedTypeIds={definition.targetTypeIds}
              excludeIds={[cardId, ...ids]}
              onPick={(picked) => save(multiple ? [...ids, picked] : [picked])}
            >
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("properties.pickFor", { name: definition.label })}
              >
                <Plus />
                {multiple ? t("properties.addLink") : t("properties.chooseCard")}
              </Button>
            </CardPicker>
          </li>
        )}
      </ul>
      {setValue.isError && <AppErrorMessage error={setValue.error} />}
    </div>
  );
}

function PropertyRow({
  cardId,
  property,
  editorOpen,
}: {
  cardId: string;
  property: CardProperty;
  /** The property was just added: its editor opens to name it. */
  editorOpen: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const types = useCardTypes();
  const { definition } = property;
  const link = definition.kind === "card" || definition.kind === "cards";

  return (
    <div className="grid grid-cols-[10rem_1fr] items-center gap-3">
      {definition.owner.on === "card" ? (
        <PropertyEditor property={definition} types={types.data ?? []} defaultOpen={editorOpen}>
          <button
            type="button"
            aria-label={t("properties.edit", { name: definition.label })}
            className="flex items-center gap-1 truncate rounded-sm text-left text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="truncate">{definition.label}</span>
            <Settings2 aria-hidden className="size-3 shrink-0" />
          </button>
        </PropertyEditor>
      ) : link ? (
        <span className="truncate text-sm text-muted-foreground">{definition.label}</span>
      ) : (
        <label htmlFor={id} className="truncate text-sm text-muted-foreground">
          {definition.label}
        </label>
      )}
      {link ? (
        <LinkValue cardId={cardId} property={property} inputId={id} />
      ) : (
        <TextValue cardId={cardId} property={property} inputId={id} />
      )}
    </div>
  );
}

/** "Properties" of a card: its type's, then its own, with their values. */
export function CardProperties({ cardId }: { cardId: string }) {
  const { t } = useTranslation();
  const properties = useCardProperties(cardId);
  const create = useCreateProperty();
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const shown = properties.data ?? [];

  return (
    <section aria-label={t("properties.title")} className="flex flex-col gap-2">
      <h2 className="text-sm font-bold text-muted-foreground">{t("properties.title")}</h2>
      {properties.error && <AppErrorMessage error={properties.error} />}
      {shown.map((property) => (
        <PropertyRow
          key={property.definition.id}
          cardId={cardId}
          property={property}
          editorOpen={property.definition.id === justCreated}
        />
      ))}
      {properties.data && shown.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("properties.cardNone")}</p>
      )}
      {create.isError && <AppErrorMessage error={create.error} />}
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        disabled={create.isPending}
        onClick={() =>
          create.mutate(
            { owner: { on: "card", cardId }, label: t("properties.newName"), kind: "text" },
            { onSuccess: (property) => setJustCreated(property.id) },
          )
        }
      >
        <Plus />
        {t("properties.addToCard")}
      </Button>
    </section>
  );
}
