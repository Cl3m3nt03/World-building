import type { CSSProperties } from "react";
import { AssetImage } from "@/features/media";
import type { BookStyle, Cover } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { COVER_FONT, lightText } from "../cover/coverArt";

/** Colours offered for a book (the user may pick any other). */
export const BOOK_COLORS = [
  "#2f4b6e",
  "#1f5f57",
  "#3d5a2a",
  "#7a2e2e",
  "#6b2f5c",
  "#4a3a7a",
  "#8a5a1c",
  "#2b2b2b",
  "#e8e0cc",
] as const;

/** The texture of each finish, drawn over the book's colour. */
const FINISH: Record<BookStyle["finish"], string> = {
  cloth:
    "repeating-linear-gradient(45deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px), repeating-linear-gradient(-45deg, rgb(0 0 0 / 0.06) 0 1px, transparent 1px 3px)",
  leather:
    "radial-gradient(120% 80% at 30% 20%, rgb(255 255 255 / 0.16), transparent 60%), radial-gradient(circle at 70% 80%, rgb(0 0 0 / 0.25), transparent 55%)",
  paper: "linear-gradient(180deg, rgb(255 255 255 / 0.06), rgb(0 0 0 / 0.06))",
};

type Props = {
  title: string;
  bookStyle: BookStyle;
  cover: Cover;
  className?: string | undefined;
  /** Larger title (the creation screen's preview). */
  large?: boolean;
};

/**
 * A story's book seen from the front, in 2D (the list of stories, and the
 * stand-in of the 3D book without WebGL): its colour and finish, its cover
 * image, and its title at the chosen place. Decorative: the story's name is
 * given next to it.
 */
export function BookCover({ title, bookStyle, cover, className, large = false }: Props) {
  const light = lightText(bookStyle.color);
  const position = cover.titlePosition;
  return (
    <div
      aria-hidden
      className={cn(
        "relative aspect-[2/3] overflow-hidden rounded-r-md rounded-l-sm shadow-[4px_6px_16px_rgb(0_0_0/0.35)]",
        className,
      )}
      style={{ backgroundColor: bookStyle.color, backgroundImage: FINISH[bookStyle.finish] }}
    >
      {/* The illustration sits on the cover, framed by the book's colour. */}
      {cover.assetId && (
        <span className="absolute inset-y-[5%] right-[6%] left-[11%] overflow-hidden rounded-sm shadow-inner">
          <AssetImage
            assetId={cover.assetId}
            alt=""
            draggable={false}
            className="size-full object-cover"
          />
        </span>
      )}
      {/* The spine's fold, then a shade behind the title for its contrast. */}
      <span className="absolute inset-y-0 left-0 w-[7%] bg-gradient-to-r from-black/35 to-transparent" />
      <span
        className={cn(
          "absolute inset-x-0 flex px-[10%] py-[12%] text-center",
          position === "top" && "top-0 items-start bg-gradient-to-b",
          position === "middle" && "inset-y-0 items-center",
          position === "bottom" && "bottom-0 items-end bg-gradient-to-t",
          cover.assetId &&
            position !== "middle" &&
            (light ? "from-black/60 to-transparent" : "from-white/70 to-transparent"),
        )}
      >
        <span
          className={cn(
            "w-full font-bold break-words",
            large ? "text-3xl" : "text-base",
            cover.assetId && position === "middle" && "rounded px-2 py-1",
            cover.assetId && position === "middle" && (light ? "bg-black/45" : "bg-white/60"),
          )}
          style={
            {
              fontFamily: COVER_FONT,
              color: light ? "rgb(250 246 236)" : "rgb(32 28 24)",
            } as CSSProperties
          }
        >
          {title}
        </span>
      </span>
    </div>
  );
}
