import { useSettings } from "@/features/settings";
import { thumbnailUrl, useCurrentWorld } from "@/features/world";
import { useAssetUrl } from "@/lib/assets";

/**
 * Image behind the whole interface (ADR 0003): the main image of the open
 * world, else, on the world list, the thumbnail of the last opened world.
 */
function useBackdropImage(): string | undefined {
  const { data: world } = useCurrentWorld();
  const settings = useSettings();
  const mainImage = useAssetUrl(world?.mainImage);
  if (world) return mainImage;
  const last = settings.data?.recentWorlds[0];
  return last ? thumbnailUrl(last) : undefined;
}

/** Full-screen backdrop, blurred and darkened. Without an image, the token gradient. */
export function Backdrop() {
  const imageUrl = useBackdropImage();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {imageUrl ? (
        <img
          key={imageUrl}
          src={imageUrl}
          alt=""
          className="absolute inset-0 size-full scale-110 object-cover"
          style={{ filter: "blur(var(--bz-blur-backdrop))" }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "var(--bz-backdrop-gradient)" }} />
      )}
      <div className="absolute inset-0" style={{ background: "var(--bz-backdrop-overlay)" }} />
    </div>
  );
}
