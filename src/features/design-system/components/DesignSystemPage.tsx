import { ArrowLeft, Bold, Italic, Plus, Underline } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Atlas } from "@/app/shell/Atlas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TranslationKey } from "@/i18n";

type Scheme = "light" | "dark";

/** The colours of the palette, by their token. */
const COLOURS = [
  "--bz-bg",
  "--bz-surface-strong",
  "--bz-text",
  "--bz-text-muted",
  "--bz-accent",
  "--bz-verdigris",
  "--bz-danger",
  "--bz-border-strong",
];
const TYPE_COLOURS = ["red", "orange", "amber", "green", "teal", "blue", "violet", "pink", "slate"];

function Block({ title, children }: { title: TranslationKey; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3">
      <h3 className="rubric">{t(title)}</h3>
      {children}
    </section>
  );
}

function Colours() {
  return (
    <Block title="designSystem.colours">
      <div className="grid grid-cols-4 gap-2">
        {COLOURS.map((token) => (
          <div key={token} className="flex flex-col gap-1">
            <div
              className="h-10 rounded-md border border-border"
              style={{ background: `var(${token})` }}
            />
            <code className="truncate text-[0.6875rem] text-muted-foreground">{token}</code>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TYPE_COLOURS.map((name) => (
          <span
            key={name}
            className="size-5 rounded-full"
            title={`--bz-type-${name}`}
            style={{ background: `var(--bz-type-${name})` }}
          />
        ))}
      </div>
    </Block>
  );
}

function Typography() {
  const { t } = useTranslation();
  return (
    <Block title="designSystem.typography">
      <h1 className="text-3xl font-bold">{t("designSystem.sample.title")}</h1>
      <h2 className="text-xl font-semibold">{t("designSystem.sample.heading")}</h2>
      <p className="rubric">{t("designSystem.sample.rubric")}</p>
      <p className="prose-bz">
        {t("designSystem.sample.body")} <em>{t("designSystem.sample.italic")}</em>
      </p>
      <p className="text-sm text-muted-foreground">{t("designSystem.sample.muted")}</p>
    </Block>
  );
}

/** The three levels of glass, over a piece of the atlas. */
function Glass({ scheme }: { scheme: Scheme }) {
  const { t } = useTranslation();
  return (
    <Block title="designSystem.glass">
      <div className="relative h-56 overflow-hidden rounded-lg border border-border">
        <div className="absolute inset-0" style={{ background: "var(--bz-backdrop-gradient)" }} />
        <Atlas seed={`design-system-${scheme}`} />
        <div className="relative grid h-full grid-cols-3 items-center gap-3 p-4">
          <div className="glass-veil rounded-full px-3 py-2 text-center text-sm">
            {t("designSystem.veil")}
          </div>
          <div className="glass-panel rounded-lg p-3 text-sm">{t("designSystem.panel")}</div>
          <div className="glass-float rounded-xl p-3 text-sm">{t("designSystem.float")}</div>
        </div>
      </div>
    </Block>
  );
}

function Primitives({ scheme }: { scheme: Scheme }) {
  const { t } = useTranslation();
  const id = (name: string) => `ds-${scheme}-${name}`;
  return (
    <Block title="designSystem.primitives">
      <div className="flex flex-wrap items-center gap-2">
        <Button>
          <Plus />
          {t("designSystem.button.primary")}
        </Button>
        <Button variant="outline">{t("designSystem.button.outline")}</Button>
        <Button variant="secondary">{t("designSystem.button.secondary")}</Button>
        <Button variant="ghost">{t("designSystem.button.ghost")}</Button>
        <Button variant="destructive">{t("designSystem.button.destructive")}</Button>
        <Button variant="link">{t("designSystem.button.link")}</Button>
        <Button disabled>{t("designSystem.button.disabled")}</Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("name")}>{t("designSystem.field.label")}</Label>
          <Input id={id("name")} placeholder={t("designSystem.field.placeholder")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("error")}>{t("designSystem.field.error")}</Label>
          <Input id={id("error")} aria-invalid defaultValue="Erebor" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("genre")}>{t("designSystem.field.select")}</Label>
          <Select defaultValue="fantasy">
            <SelectTrigger id={id("genre")} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fantasy">{t("genre.fantasy")}</SelectItem>
              <SelectItem value="sf">{t("genre.scienceFiction")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("disabled")}>{t("designSystem.field.disabled")}</Label>
          <Input id={id("disabled")} disabled defaultValue="—" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Tabs defaultValue="map">
          <TabsList>
            <TabsTrigger value="map">{t("designSystem.tabs.map")}</TabsTrigger>
            <TabsTrigger value="graph">{t("designSystem.tabs.graph")}</TabsTrigger>
            <TabsTrigger value="tree">{t("designSystem.tabs.tree")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <ToggleGroup type="multiple" defaultValue={["bold"]} aria-label={t("designSystem.toggle")}>
          <ToggleGroupItem value="bold" aria-label={t("designSystem.toggle.bold")} className="w-8">
            <Bold />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="italic"
            aria-label={t("designSystem.toggle.italic")}
            className="w-8"
          >
            <Italic />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="underline"
            aria-label={t("designSystem.toggle.underline")}
            className="w-8"
          >
            <Underline />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch id={id("switch")} defaultChecked />
          <Label htmlFor={id("switch")}>{t("designSystem.switch")}</Label>
        </div>
        <RadioGroup
          defaultValue="a"
          className="flex w-auto gap-4"
          aria-label={t("designSystem.radio")}
        >
          {(["a", "b"] as const).map((value) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} id={id(`radio-${value}`)} />
              <Label htmlFor={id(`radio-${value}`)}>{t(`designSystem.radio.${value}`)}</Label>
            </div>
          ))}
        </RadioGroup>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm">
              {t("designSystem.tooltip")}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("designSystem.tooltipContent")}</TooltipContent>
        </Tooltip>
      </div>
    </Block>
  );
}

/** One theme of the system, on its own paper. */
function Specimen({ scheme }: { scheme: Scheme }) {
  const { t } = useTranslation();
  return (
    <div
      data-scheme={scheme}
      className="flex flex-col gap-6 rounded-xl border border-border bg-background p-5 text-foreground"
    >
      <h2 className="text-lg font-semibold">{t(`designSystem.scheme.${scheme}`)}</h2>
      <Colours />
      <Typography />
      <Glass scheme={scheme} />
      <Primitives scheme={scheme} />
    </div>
  );
}

/**
 * The design system of the V2 (ADR 0012), reached from the settings (About):
 * every piece in both themes side by side, to check them together.
 */
export function DesignSystemPage() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <header className="glass-veil flex items-center gap-2 self-start rounded-full py-1 pr-4 pl-1">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() => window.history.back()}
        >
          <ArrowLeft />
          {t("designSystem.back")}
        </Button>
        <h1 className="text-base font-semibold">{t("designSystem.title")}</h1>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <p className="mx-auto mb-3 max-w-5xl px-1 text-sm text-muted-foreground">
          {t("designSystem.description")}
        </p>
        <div className="mx-auto grid max-w-6xl gap-4 pb-4 lg:grid-cols-2">
          <Specimen scheme="light" />
          <Specimen scheme="dark" />
        </div>
      </main>
    </div>
  );
}
