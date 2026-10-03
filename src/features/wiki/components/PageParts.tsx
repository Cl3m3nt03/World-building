import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { WIKI_BUTTON, WIKI_FOCUS } from "./styles";

/** Back to the wiki's home page, above a page. */
export function HomeLink() {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  return (
    <Link
      to="/world/$worldId/wiki"
      params={{ worldId }}
      className={cn(
        "flex items-center gap-1.5 self-start rounded text-sm text-wiki-muted hover:text-wiki-text [&_svg]:size-4",
        WIKI_FOCUS,
      )}
    >
      <ArrowLeft aria-hidden />
      {t("wiki.page.home")}
    </Link>
  );
}

/** A document without a page in the wiki (hidden since, or never shown). */
export function NotInWiki({ message }: { message: string }) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <EyeOff aria-hidden className="size-8 text-wiki-muted" />
      <p className="font-wiki-heading text-lg font-bold">{message}</p>
      <Link to="/world/$worldId/wiki" params={{ worldId }} className={WIKI_BUTTON}>
        {t("wiki.page.home")}
      </Link>
    </div>
  );
}
