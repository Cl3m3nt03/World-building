import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { newId, type Stats5eBlock } from "../model";
import {
  ABILITIES,
  type Ability,
  formatBonus,
  MAX_SCORE,
  MIN_SCORE,
  modifier,
  readWholeNumber,
  SKILLS,
  type Skill,
  skillBonus,
} from "./rules";

type Props = {
  block: Stats5eBlock;
  label: string;
  onChange: (block: Stats5eBlock) => void;
};

/**
 * A whole number typed in a small field. The text can be anything while
 * typing; only a valid number is passed on, and the field says when it is
 * not one.
 */
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  optional = false,
  className,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  /** An empty field means "no value". */
  optional?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(value === null ? "" : String(value));
  const errorId = useId();

  useEffect(() => setText(value === null ? "" : String(value)), [value]);

  // `undefined`: not a valid value (nothing is passed on).
  const parse = (raw: string): number | null | undefined => {
    if (raw.trim() === "") return optional ? null : undefined;
    return readWholeNumber(raw, min, max) ?? undefined;
  };
  const invalid = parse(text) === undefined;

  return (
    <span className="flex flex-col gap-0.5">
      <Input
        aria-label={label}
        inputMode="numeric"
        value={text}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(event) => {
          setText(event.target.value);
          const parsed = parse(event.target.value);
          if (parsed !== undefined) onChange(parsed);
        }}
        // Out of range: shown clamped once the field is left.
        onBlur={() => {
          const parsed = parse(text);
          if (parsed !== undefined) setText(parsed === null ? "" : String(parsed));
        }}
        className={className}
      />
      {invalid && (
        <span id={errorId} className="text-xs text-destructive">
          {t("stats.notANumber", { min, max })}
        </span>
      )}
    </span>
  );
}

/**
 * A D&D 5e sheet: abilities with their computed modifier, armor class, hit
 * points, speed, proficiency bonus, skills (proficient or not, with their
 * computed bonus) and actions.
 */
export function Stats5eBlockView({ block, label, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const set = (changes: Partial<Stats5eBlock>) => onChange({ ...block, ...changes });
  const setAbility = (ability: Ability, score: number) =>
    set({ abilities: { ...block.abilities, [ability]: score } });
  // Alphabetical in the app language, not by internal key.
  const sortedSkills = [...SKILLS].sort((a, b) =>
    t(`stats.skill.${a.key}`).localeCompare(t(`stats.skill.${b.key}`), i18n.language),
  );
  const toggleSkill = (skill: Skill) =>
    set({
      skills: block.skills.includes(skill)
        ? block.skills.filter((other) => other !== skill)
        : [...block.skills, skill],
    });

  return (
    <section aria-label={label} className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <h3 className="font-heading text-sm font-bold">{t("stats.title")}</h3>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITIES.map((ability) => (
          <div
            key={ability}
            className="flex flex-col items-center gap-1 rounded-lg bg-secondary/60 p-2 text-center"
          >
            <span className="text-xs font-bold tracking-wide text-muted-foreground">
              {t(`stats.abilityShort.${ability}`)}
            </span>
            <NumberField
              label={t(`stats.ability.${ability}`)}
              value={block.abilities[ability]}
              min={MIN_SCORE}
              max={MAX_SCORE}
              onChange={(score) => {
                if (score !== null) setAbility(ability, score);
              }}
              className="h-8 w-14 text-center"
            />
            <output
              aria-label={t("stats.modifierOf", { ability: t(`stats.ability.${ability}`) })}
              className="font-heading text-lg font-bold"
            >
              {formatBonus(modifier(block.abilities[ability]))}
            </output>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="flex flex-col gap-1">
          <span aria-hidden className="text-xs text-muted-foreground">
            {t("stats.armorClass")}
          </span>
          <NumberField
            label={t("stats.armorClass")}
            value={block.armorClass}
            min={0}
            max={99}
            optional
            onChange={(armorClass) => set({ armorClass })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span aria-hidden className="text-xs text-muted-foreground">
            {t("stats.hitPoints")}
          </span>
          <NumberField
            label={t("stats.hitPoints")}
            value={block.hitPoints}
            min={0}
            max={9999}
            optional
            onChange={(hitPoints) => set({ hitPoints })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span aria-hidden className="text-xs text-muted-foreground">
            {t("stats.hitDice")}
          </span>
          <Input
            aria-label={t("stats.hitDice")}
            value={block.hitDice}
            maxLength={40}
            placeholder={t("stats.hitDicePlaceholder")}
            onChange={(event) => set({ hitDice: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span aria-hidden className="text-xs text-muted-foreground">
            {t("stats.speed")}
          </span>
          <Input
            aria-label={t("stats.speed")}
            value={block.speed}
            maxLength={40}
            placeholder={t("stats.speedPlaceholder")}
            onChange={(event) => set({ speed: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span aria-hidden className="text-xs text-muted-foreground">
            {t("stats.proficiencyBonus")}
          </span>
          <NumberField
            label={t("stats.proficiencyBonus")}
            value={block.proficiencyBonus}
            min={0}
            max={20}
            onChange={(bonus) => {
              if (bonus !== null) set({ proficiencyBonus: bonus });
            }}
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-1 border-0">
        <legend className="mb-1 text-xs font-bold text-muted-foreground">
          {t("stats.skills")}
        </legend>
        <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
          {sortedSkills.map(({ key, ability }) => {
            const proficient = block.skills.includes(key);
            return (
              <label
                key={key}
                className="flex items-center gap-2 rounded-sm px-1 py-0.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={proficient}
                  onChange={() => toggleSkill(key)}
                  aria-label={t("stats.proficientIn", { skill: t(`stats.skill.${key}`) })}
                  className="accent-primary"
                />
                <span className="w-8 shrink-0 text-right font-mono text-xs">
                  {formatBonus(
                    skillBonus(block.abilities[ability], proficient, block.proficiencyBonus),
                  )}
                </span>
                <span className="truncate">{t(`stats.skill.${key}`)}</span>
                <span className="text-xs text-muted-foreground">
                  {t("stats.skillAbility", { ability: t(`stats.abilityShort.${ability}`) })}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-bold text-muted-foreground">{t("stats.actions")}</h4>
        {block.actions.map((action, index) => (
          <div key={action.id} className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Input
                aria-label={t("stats.actionName", { index: index + 1 })}
                placeholder={t("stats.actionNamePlaceholder")}
                value={action.name}
                maxLength={80}
                onChange={(event) =>
                  set({
                    actions: block.actions.map((other) =>
                      other.id === action.id ? { ...other, name: event.target.value } : other,
                    ),
                  })
                }
                className="font-medium"
              />
              <textarea
                aria-label={t("stats.actionDescription", { index: index + 1 })}
                placeholder={t("stats.actionDescriptionPlaceholder")}
                value={action.description}
                maxLength={2000}
                rows={2}
                onChange={(event) =>
                  set({
                    actions: block.actions.map((other) =>
                      other.id === action.id
                        ? { ...other, description: event.target.value }
                        : other,
                    ),
                  })
                }
                className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("stats.deleteAction", { index: index + 1 })}
              onClick={() =>
                set({ actions: block.actions.filter((other) => other.id !== action.id) })
              }
              className="text-destructive"
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() =>
            set({ actions: [...block.actions, { id: newId(), name: "", description: "" }] })
          }
        >
          <Plus />
          {t("stats.addAction")}
        </Button>
      </div>
    </section>
  );
}
