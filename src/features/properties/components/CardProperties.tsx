import { Plus, Settings2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CardProperty, PropertyValue } from "@/lib/bindings";
import { useCardProperties, useCreateProperty, useSetPropertyValue } from "../hooks/useProperties";
import { PropertyEditor } from "./PropertyEditor";

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

function ValueField({
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
  const setValue = useSetPropertyValue(cardId);
  const saved = toText(property.value);
  const [text, setText] = useState(saved);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();
  const { definition } = property;
  const invalid =
    definition.kind === "number" && text.trim() !== "" && fromText("number", text) === null;

  useEffect(() => setText(saved), [saved]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const save = (value: string) => {
    clearTimeout(timer.current);
    if (value === saved) return;
    if (definition.kind === "number" && value.trim() !== "" && fromText("number", value) === null) {
      return;
    }
    setValue.mutate({ propertyId: definition.id, value: fromText(definition.kind, value) });
  };

  return (
    <div className="grid grid-cols-[10rem_1fr] items-center gap-3">
      {definition.owner.on === "card" ? (
        <PropertyEditor property={definition} defaultOpen={editorOpen}>
          <button
            type="button"
            aria-label={t("properties.edit", { name: definition.label })}
            className="flex items-center gap-1 truncate rounded-sm text-left text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="truncate">{definition.label}</span>
            <Settings2 aria-hidden className="size-3 shrink-0" />
          </button>
        </PropertyEditor>
      ) : (
        <label htmlFor={id} className="truncate text-sm text-muted-foreground">
          {definition.label}
        </label>
      )}
      <div className="flex flex-col gap-1">
        <Input
          id={id}
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
          onBlur={() => save(text)}
        />
        {invalid && <p className="text-xs text-destructive">{t("properties.notANumber")}</p>}
        {setValue.isError && <AppErrorMessage error={setValue.error} />}
      </div>
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
        <ValueField
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
