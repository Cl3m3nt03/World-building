import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { PropertyDefinition, PropertyOption, PropertyOptionInput } from "@/lib/bindings";
import { useCountOptionValues, useSetPropertyOptions } from "../hooks/useProperties";

/** Limits of the Rust side (`domain::properties`). */
const MAX_OPTIONS = 100;
const MAX_OPTION_LEN = 80;

/**
 * The choices of a « select » property, in its small window: rename them in
 * place, order them, add one (Enter), remove one, and allow several per card.
 * Removing a choice that cards hold says how many, then asks.
 */
export function PropertyOptions({ property }: { property: PropertyDefinition }) {
  const { t } = useTranslation();
  const save = useSetPropertyOptions();
  const count = useCountOptionValues();
  const [added, setAdded] = useState("");
  const [removing, setRemoving] = useState<{ option: PropertyOption; cards: number } | null>(null);
  const addId = useId();
  const multipleId = useId();
  const { options, multiple } = property;

  // Each change sends the whole list: wait for the last one to be read back.
  const commit = (next: PropertyOptionInput[], nextMultiple = multiple) =>
    save.mutateAsync({ id: property.id, options: next, multiple: nextMultiple }).catch(() => {});

  const add = () => {
    const label = added.trim();
    if (label === "" || save.isPending || options.length >= MAX_OPTIONS) return;
    setAdded("");
    void commit([...options, { id: null, label }]);
  };

  const rename = (option: PropertyOption, input: HTMLInputElement) => {
    const label = input.value.trim();
    if (label === "") input.value = option.label;
    else if (label !== option.label) {
      void commit(options.map((each) => (each.id === option.id ? { ...each, label } : each)));
    }
  };

  const move = (index: number, by: -1 | 1) => {
    const other = options[index + by];
    const option = options[index];
    if (!other || !option || save.isPending) return;
    const next = [...options];
    next[index] = other;
    next[index + by] = option;
    void commit(next);
  };

  const remove = (option: PropertyOption) =>
    commit(options.filter((each) => each.id !== option.id)).then(() => setRemoving(null));

  const askRemove = async (option: PropertyOption) => {
    const cards = await count.mutateAsync({ id: property.id, optionId: option.id }).catch(() => 0);
    if (cards > 0) setRemoving({ option, cards });
    else void remove(option);
  };

  return (
    <fieldset className="flex flex-col gap-1.5 border-0">
      <legend className="mb-1 text-xs font-bold text-muted-foreground">
        {t("properties.options")}
      </legend>
      {options.length > 0 && (
        <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto pr-0.5">
          {options.map((option, index) => (
            <li key={option.id} className="flex items-center gap-0.5">
              <Input
                aria-label={t("properties.optionName", { name: option.label })}
                defaultValue={option.label}
                maxLength={MAX_OPTION_LEN}
                className="h-7 min-w-0 flex-1 px-2"
                onBlur={(event) => rename(option, event.currentTarget)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") rename(option, event.currentTarget);
                }}
              />
              {/* aria-disabled and not disabled: the arrow keeps the focus at the end of the list. */}
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("properties.optionUp", { name: option.label })}
                aria-disabled={index === 0}
                className="aria-disabled:opacity-40"
                onClick={() => move(index, -1)}
              >
                <ChevronUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("properties.optionDown", { name: option.label })}
                aria-disabled={index === options.length - 1}
                className="aria-disabled:opacity-40"
                onClick={() => move(index, 1)}
              >
                <ChevronDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("properties.optionRemove", { name: option.label })}
                onClick={() => void askRemove(option)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {removing && (
        <div role="alert" className="flex flex-col gap-2 text-sm">
          <p>
            {t("properties.optionRemoveLoses", {
              name: removing.option.label,
              count: removing.cards,
            })}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRemoving(null)}>
              {t("createWorld.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={save.isPending}
              onClick={() => void remove(removing.option)}
            >
              {t("properties.optionRemoveConfirm")}
            </Button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-1">
        <label htmlFor={addId} className="sr-only">
          {t("properties.optionAdd")}
        </label>
        <Input
          id={addId}
          value={added}
          maxLength={MAX_OPTION_LEN}
          placeholder={t("properties.optionAdd")}
          disabled={options.length >= MAX_OPTIONS}
          className="h-7 min-w-0 flex-1 px-2"
          onChange={(event) => setAdded(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("properties.optionAdd")}
          disabled={added.trim() === ""}
          onClick={add}
        >
          <Plus />
        </Button>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Switch
          id={multipleId}
          size="sm"
          checked={multiple}
          onCheckedChange={(next) => void commit(options, next)}
        />
        <label htmlFor={multipleId} className="text-sm">
          {t("properties.multiple")}
        </label>
      </div>
      {multiple && <p className="text-xs text-muted-foreground">{t("properties.multipleHint")}</p>}
      {save.error && <AppErrorMessage error={save.error} />}
      {count.error && <AppErrorMessage error={count.error} />}
    </fieldset>
  );
}
