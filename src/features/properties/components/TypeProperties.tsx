import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  useApplyPropertyToExisting,
  useCreateProperty,
  useTypeProperties,
} from "../hooks/useProperties";
import { kindIcon, PropertyEditor } from "./PropertyEditor";

/**
 * "Properties" of a card type (types screen). A property added here shows
 * on the new cards of the type; the banner offers to apply it to the
 * existing ones too.
 */
export function TypeProperties({ typeId }: { typeId: string }) {
  const { t } = useTranslation();
  const properties = useTypeProperties(typeId);
  const create = useCreateProperty();
  const apply = useApplyPropertyToExisting();
  // Properties added while this type is open and not yet applied to its cards.
  const [pending, setPending] = useState<string[]>([]);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const add = () =>
    create.mutate(
      {
        owner: { on: "type", typeId },
        label: t("properties.newName"),
        kind: "text",
      },
      {
        onSuccess: (property) => {
          setPending((ids) => [...ids, property.id]);
          setJustCreated(property.id);
        },
      },
    );

  const applyAll = async () => {
    for (const id of pending) await apply.mutateAsync(id);
    setPending([]);
  };

  return (
    <div className="flex flex-col gap-2">
      {pending.length > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-lg bg-primary/15 px-3 py-2 text-sm"
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
      <ul className="flex flex-col gap-1">
        {properties.data?.map((property) => {
          const Icon = kindIcon(property.kind);
          return (
            <li key={property.id}>
              <PropertyEditor property={property} defaultOpen={property.id === justCreated}>
                <button
                  type="button"
                  aria-label={t("properties.edit", { name: property.label })}
                  className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Icon aria-hidden className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{property.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`properties.kinds.${property.kind}`)}
                  </span>
                </button>
              </PropertyEditor>
            </li>
          );
        })}
      </ul>
      {(create.error ?? apply.error) && <AppErrorMessage error={create.error ?? apply.error} />}
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        disabled={create.isPending}
        onClick={add}
      >
        <Plus />
        {t("properties.add")}
      </Button>
    </div>
  );
}
