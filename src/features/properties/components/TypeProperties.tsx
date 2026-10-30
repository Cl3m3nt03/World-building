import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { typeColor, typeIcon } from "@/features/card-types";
import type { CardType, PropertyDefinition } from "@/lib/bindings";
import { useApplyPropertyToExisting, useTypeProperties } from "../hooks/useProperties";
import { AddPropertyPopover } from "./AddPropertyPopover";
import { kindIcon, PropertyEditor } from "./PropertyEditor";

/** What a property holds, in a few words: its kind, and for a link the types it accepts. */
function KindSummary({ property, types }: { property: PropertyDefinition; types: CardType[] }) {
  const { t } = useTranslation();
  const targets = property.targetTypeIds
    .map((id) => types.find((type) => type.id === id))
    .filter((type) => type !== undefined);
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      {t(`properties.kinds.${property.kind}`)}
      {property.kind === "select" && (
        <span>{t("properties.optionCount", { count: property.options.length })}</span>
      )}
      {targets.map((type) => {
        const Icon = typeIcon(type.icon);
        return (
          <span key={type.id} className="flex items-center gap-0.5">
            <Icon aria-hidden className="size-3.5" style={{ color: typeColor(type.color) }} />
            {type.name}
          </span>
        );
      })}
    </span>
  );
}

/**
 * "Default properties" of a card type (types screen). A property added here
 * (« + Add a property », the same small window as on a card) shows on the
 * new cards of the type; the banner offers to apply it to the existing ones
 * too.
 */
export function TypeProperties({ typeId, types }: { typeId: string; types: CardType[] }) {
  const { t } = useTranslation();
  const properties = useTypeProperties(typeId);
  const apply = useApplyPropertyToExisting();
  // Properties added while this type is open and not yet applied to its cards.
  const [pending, setPending] = useState<string[]>([]);
  // A select just added: its window opens to list its choices.
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const applyAll = async () => {
    for (const id of pending) await apply.mutateAsync(id);
    setPending([]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {pending.length > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-md border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] px-3 py-1.5 text-sm"
        >
          <span className="flex-1">{t("properties.applyAsk")}</span>
          <Button variant="ghost" size="sm" onClick={() => setPending([])}>
            {t("properties.applySkip")}
          </Button>
          <Button size="sm" disabled={apply.isPending} onClick={() => void applyAll()}>
            {t("properties.applyYes")}
          </Button>
        </div>
      )}
      {properties.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("properties.none")}</p>
      )}
      {properties.data && properties.data.length > 0 && (
        <ul className="flex flex-col">
          {properties.data.map((property) => {
            const Icon = kindIcon(property.kind);
            return (
              <li key={property.id} className="border-b border-border last:border-b-0">
                <PropertyEditor
                  property={property}
                  types={types}
                  defaultOpen={property.id === justAdded}
                >
                  <button
                    type="button"
                    aria-label={t("properties.edit", { name: property.label })}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors duration-(--bz-duration-fast) ease-atlas hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{property.label}</span>
                    <KindSummary property={property} types={types} />
                  </button>
                </PropertyEditor>
              </li>
            );
          })}
        </ul>
      )}
      {apply.error && <AppErrorMessage error={apply.error} />}
      <AddPropertyPopover
        owner={{ on: "type", typeId }}
        types={types}
        onCreated={(property) => {
          setPending((ids) => [...ids, property.id]);
          if (property.kind === "select") setJustAdded(property.id);
        }}
      />
    </div>
  );
}
