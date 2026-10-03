import { type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChoiceTiles } from "@/features/card-types";
import type { RelationCategory, RelationType, RelationTypeInput } from "@/lib/bindings";
import { RELATION_ICON_NAMES, relationIcon, relationName } from "../relations";

/** Categories offered: where the type shows in the relation list. */
const CATEGORIES = [
  { value: "family", label: "trees.relationTypes.family" },
  { value: "couple", label: "trees.relationTypes.couple" },
  { value: "other", label: "trees.relationTypes.other" },
] as const;

/** The inverse field: none, the type itself (symmetric) or another type of the world. */
const NONE = "none";
const ITSELF = "itself";

export function emptyRelationInput(): RelationTypeInput {
  return { name: "", icon: "link", category: "other", inverseId: null, symmetric: false };
}

/** The form's values for an existing type of the world. */
export function relationInput(type: RelationType): RelationTypeInput {
  const symmetric = type.inverseId === type.id;
  return {
    name: type.name,
    icon: type.icon,
    // Older types of the world were « custom »: they show as « other ».
    category: type.category === "custom" ? "other" : type.category,
    inverseId: symmetric ? null : type.inverseId,
    symmetric,
  };
}

/**
 * A relation type of the world: its name, its icon, where it shows in the
 * relation list, and its inverse (parent ↔ child), kept both ways. The
 * provided types cannot be an inverse (their pairs stay). `children` holds
 * the form's buttons.
 */
export function RelationTypeForm({
  initial,
  relationTypes,
  editingId,
  onSubmit,
  children,
}: {
  initial: RelationTypeInput;
  /** The world's types (the inverse is chosen among them). */
  relationTypes: RelationType[];
  /** The type being changed (it cannot be its own inverse except as « itself »). */
  editingId: string | null;
  onSubmit: (input: RelationTypeInput) => void;
  children: (valid: boolean) => ReactNode;
}) {
  const { t } = useTranslation();
  const ids = useId();
  const [input, setInput] = useState(initial);
  const others = relationTypes.filter((type) => !type.builtin && type.id !== editingId);
  const inverse = input.symmetric ? ITSELF : (input.inverseId ?? NONE);
  const valid = input.name.trim() !== "";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSubmit({ ...input, name: input.name.trim() });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${ids}-name`}>{t("trees.relations.customName")}</Label>
        <Input
          id={`${ids}-name`}
          value={input.name}
          autoFocus
          maxLength={100}
          placeholder={t("trees.relations.customPlaceholder")}
          onChange={(event) => setInput({ ...input, name: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span id={`${ids}-category`} className="text-sm font-medium">
          {t("trees.relationTypes.category")}
        </span>
        <ChoiceTiles
          label={t("trees.relationTypes.category")}
          value={input.category}
          onChange={(category: RelationCategory) => setInput({ ...input, category })}
          className="flex-nowrap gap-1"
          tileClassName="h-8 px-3 text-sm"
          choices={CATEGORIES.map(({ value, label }) => ({
            value,
            label: t(label),
            content: t(label),
          }))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${ids}-inverse`}>{t("trees.relationTypes.inverse")}</Label>
        <Select
          value={inverse}
          onValueChange={(value) =>
            setInput({
              ...input,
              symmetric: value === ITSELF,
              inverseId: value === ITSELF || value === NONE ? null : value,
            })
          }
        >
          <SelectTrigger id={`${ids}-inverse`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("trees.relationTypes.inverseNone")}</SelectItem>
            <SelectItem value={ITSELF}>{t("trees.relationTypes.inverseItself")}</SelectItem>
            {others.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {relationName(type, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("trees.relationTypes.inverseHint")}</p>
      </div>
      <ChoiceTiles
        label={t("trees.relations.customIcon")}
        value={input.icon}
        onChange={(icon) => setInput({ ...input, icon })}
        className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto"
        tileClassName="size-9"
        choices={RELATION_ICON_NAMES.map((value) => {
          const Icon = relationIcon(value);
          return { value, label: value, content: <Icon aria-hidden className="size-4" /> };
        })}
      />
      {children(valid)}
    </form>
  );
}
