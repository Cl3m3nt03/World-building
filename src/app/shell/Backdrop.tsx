import { useState } from "react";
import { useSettings } from "@/features/settings";
import { thumbnailUrl, useCurrentWorld } from "@/features/world";
import { resolveTheme, useWorldAccent } from "@/features/world-theme";
import { useAssetUrl } from "@/lib/assets";
import { Atlas } from "./Atlas";

/**
 * Image behind the whole interface (ADR 0003) and accent of the app. With a
 * world open: its theme (a shipped illustration, a chosen image or the main
 * image) and the theme's accent. On the world list: the thumbnail of the
 * last opened world and the default accent.
 */
function useBackdrop(): string | undefined {
  const { data: world } = useCurrentWorld();
  const settings = useSettings();
  const theme = world ? resolveTheme(world.theme, world.mainImage) : null;
  const assetUrl = useAssetUrl(theme?.backgroundAsset ?? null);
  useWorldAccent(theme?.accent ?? null);
  if (theme) return theme.presetImage ?? assetUrl;
  const last = settings.data?.recentWorlds[0];
  return last ? thumbnailUrl(last) : undefined;
}

/**
 * Full-screen backdrop: the image, blurred and veiled, with the living atlas
 * engraved over it (ADR 0012). Without an image, the atlas alone on the token
 * gradient. The atlas is the open world's own, or the app's on the world list.
 */
export function Backdrop() {
  const imageUrl = useBackdrop();
  const { data: world } = useCurrentWorld();
  // An image that cannot be shown (file removed outside the app) gives the gradient.
  const [failed, setFailed] = useState<string | null>(null);
  const shown = imageUrl && imageUrl !== failed ? imageUrl : undefined;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {shown ? (
        <img
          key={shown}
          src={shown}
          alt=""
          onError={() => setFailed(shown)}
          className="absolute inset-0 size-full scale-110 object-cover"
          style={{ filter: "blur(var(--bz-blur-backdrop))" }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "var(--bz-backdrop-gradient)" }} />
      )}
      <div className="absolute inset-0" style={{ background: "var(--bz-backdrop-overlay)" }} />
      <div
        className="absolute inset-0"
        style={shown ? { opacity: "var(--bz-atlas-over-image)" } : undefined}
      >
        <Atlas seed={world?.id ?? "builderz"} />
      </div>
    </div>
  );
}
