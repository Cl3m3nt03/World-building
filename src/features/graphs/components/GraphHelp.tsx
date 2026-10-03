import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * « À quoi sert le Graph ? » (M7.5 step 7.5.5): what the drawing shows and
 * what it is for, in a few lines, from the graph's toolbar.
 */
export function GraphHelp() {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("graphs.help.button")}
          title={t("graphs.help.button")}
        >
          <CircleHelp />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" className="glass flex w-80 flex-col gap-2 text-sm">
        <h2 className="font-heading font-bold">{t("graphs.help.button")}</h2>
        <p>{t("graphs.help.what")}</p>
        <p>{t("graphs.help.links")}</p>
        <p>{t("graphs.help.use")}</p>
      </PopoverContent>
    </Popover>
  );
}
