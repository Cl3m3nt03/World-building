import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CardType, TemplateSection } from "@/lib/bindings";
import { useUpdateCardType } from "../hooks/useCardTypes";

/** Delay before an edited template is saved. */
const SAVE_DELAY_MS = 600;

/**
 * The guided template of a type: sections with a title and a help question.
 * Applying it to a card adds one titled text block per section.
 */
export function TemplateEditor({ type, parent }: { type: CardType; parent: CardType | undefined }) {
  const { t } = useTranslation();
  const update = useUpdateCardType();
  const [sections, setSections] = useState<TemplateSection[]>(type.guidedTemplate);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<TemplateSection[] | null>(null);

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current) {
      // Sections without a title are not kept.
      const kept = pending.current.filter((section) => section.title.trim() !== "");
      update.mutate({ id: type.id, patch: { guidedTemplate: kept } });
      pending.current = null;
    }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  // Saved when another type is selected or the screen closes.
  useEffect(() => () => flushRef.current(), []);

  const change = (next: TemplateSection[], immediately = false) => {
    setSections(next);
    pending.current = next;
    clearTimeout(timer.current);
    if (immediately) flush();
    else timer.current = setTimeout(() => flushRef.current(), SAVE_DELAY_MS);
  };

  const set = (index: number, field: keyof TemplateSection, value: string) =>
    change(sections.map((section, i) => (i === index ? { ...section, [field]: value } : section)));

  const swap = (index: number, other: number) => {
    const next = [...sections];
    const a = next[index];
    const b = next[other];
    if (!a || !b) return;
    next[index] = b;
    next[other] = a;
    change(next, true);
  };

  return (
    <div className="flex flex-col gap-2">
      {parent && sections.length === 0 && parent.guidedTemplate.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("templates.inherits", { name: parent.name })}
        </p>
      )}
      {sections.length === 0 && !(parent && parent.guidedTemplate.length > 0) && (
        <p className="text-sm text-muted-foreground">{t("templates.empty")}</p>
      )}
      <ol className="flex flex-col gap-2">
        {sections.map((section, index) => (
          // Sections have no id: the index is their identity while editing.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <li key={index} className="flex items-start gap-2 rounded-lg border border-border p-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Input
                aria-label={t("templates.sectionTitle", { index: index + 1 })}
                placeholder={t("templates.titlePlaceholder")}
                value={section.title}
                maxLength={80}
                onChange={(event) => set(index, "title", event.target.value)}
                onBlur={() => flushRef.current()}
                className="font-medium"
              />
              <Input
                aria-label={t("templates.sectionPrompt", { index: index + 1 })}
                placeholder={t("templates.promptPlaceholder")}
                value={section.prompt}
                maxLength={200}
                onChange={(event) => set(index, "prompt", event.target.value)}
                onBlur={() => flushRef.current()}
                className="text-sm"
              />
            </div>
            <div className="flex flex-col">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("templates.moveUp", { index: index + 1 })}
                disabled={index === 0}
                onClick={() => swap(index, index - 1)}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("templates.moveDown", { index: index + 1 })}
                disabled={index === sections.length - 1}
                onClick={() => swap(index, index + 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("templates.delete", { index: index + 1 })}
                onClick={() =>
                  change(
                    sections.filter((_, i) => i !== index),
                    true,
                  )
                }
                className="text-destructive"
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      {update.isError && <AppErrorMessage error={update.error} />}
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => change([...sections, { title: "", prompt: "" }])}
      >
        <Plus />
        {t("templates.addSection")}
      </Button>
    </div>
  );
}
