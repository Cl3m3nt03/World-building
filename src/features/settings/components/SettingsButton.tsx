import { Settings } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SettingsDialog } from "./SettingsDialog";

/** Gear button opening the app settings (top bar and start screen). */
export function SettingsButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("shell.actions.settings")}
            className={className ?? "rounded-full"}
            onClick={() => setOpen(true)}
          >
            <Settings />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("shell.actions.settings")}</TooltipContent>
      </Tooltip>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
