import { useEffect, useRef, useState } from "react";
import { assetUrl } from "@/lib/assets";

/**
 * Listening to one sound at a time (the pickers and the sounds' editors):
 * which one plays, and a toggle to start or stop it.
 */
export function useListen() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const stop = () => {
    audio.current?.pause();
    audio.current = null;
    setPlaying(null);
  };
  const toggle = async (assetId: string, volume = 100) => {
    const same = playing === assetId;
    stop();
    if (same) return;
    try {
      // The media library's address plays as is (the CSP has no blob: media).
      const element = new Audio(assetUrl(assetId));
      element.volume = Math.min(Math.max(volume / 100, 0), 1);
      element.onended = () => setPlaying((current) => (current === assetId ? null : current));
      audio.current = element;
      setPlaying(assetId);
      await element.play();
    } catch {
      setPlaying(null);
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: stops on unmount only
  useEffect(() => stop, []);
  return {
    playing,
    toggle,
    stop,
    /** Changes the volume of the sound playing (0 to 100). */
    setVolume: (volume: number) => {
      if (audio.current) audio.current.volume = Math.min(Math.max(volume / 100, 0), 1);
    },
  };
}
