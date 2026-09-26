import { create } from "zustand";
import { useUiStore } from "@/app/stores/ui";
import { assetUrl } from "@/lib/assets";

export type Track = { id: string; name: string };

type RadioState = {
  /** Audio files of the open world's media library. */
  tracks: Track[];
  currentId: string | null;
  playing: boolean;
  setTracks: (tracks: Track[]) => void;
  /** Plays `id`, or resumes the current track, or starts the first one. */
  play: (id?: string) => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  /** Stops and forgets the current track (the world is closed). */
  stop: () => void;
};

/** Seconds after which "previous" restarts the track instead of going back. */
const RESTART_THRESHOLD_S = 3;

/**
 * One audio element for the whole app, outside React: the music goes on
 * while the tabs and screens change.
 */
let audio: HTMLAudioElement | null = null;

function element(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.addEventListener("ended", () => {
      const { radioMode } = useUiStore.getState();
      if (radioMode === "repeatOne") useRadio.getState().play();
      else useRadio.getState().next();
    });
  }
  return audio;
}

function applyVolume(volume: number) {
  if (audio) audio.volume = volume / 100;
}
useUiStore.subscribe((state, previous) => {
  if (state.radioVolume !== previous.radioVolume) applyVolume(state.radioVolume);
});

function indexOf(tracks: Track[], id: string | null): number {
  return tracks.findIndex((track) => track.id === id);
}

export const useRadio = create<RadioState>()((set, get) => ({
  tracks: [],
  currentId: null,
  playing: false,

  setTracks: (tracks) => {
    set({ tracks });
    const { currentId } = get();
    // The current track was deleted from the media library.
    if (currentId && indexOf(tracks, currentId) === -1) get().stop();
  },

  play: (id) => {
    const { tracks, currentId } = get();
    const target = id ?? currentId ?? tracks[0]?.id;
    if (!target) return;
    const player = element();
    if (target !== currentId || !player.src) player.src = assetUrl(target);
    else if (player.ended) player.currentTime = 0;
    applyVolume(useUiStore.getState().radioVolume);
    set({ currentId: target, playing: true });
    const failed = (error: unknown) => {
      console.warn("Cannot play the track", error);
      set({ playing: false });
    };
    try {
      Promise.resolve(player.play()).catch(failed);
    } catch (error) {
      failed(error);
    }
  },

  pause: () => {
    audio?.pause();
    set({ playing: false });
  },

  toggle: () => (get().playing ? get().pause() : get().play()),

  next: () => {
    const { tracks, currentId } = get();
    if (tracks.length === 0) return;
    const current = indexOf(tracks, currentId);
    let index = (current + 1) % tracks.length;
    if (useUiStore.getState().radioMode === "shuffle" && tracks.length > 1) {
      // Any track but the current one, uniformly.
      const offset = Math.floor(Math.random() * (tracks.length - 1));
      index = current === -1 ? offset : (current + 1 + offset) % tracks.length;
    }
    get().play(tracks[index]?.id);
  },

  previous: () => {
    const { tracks, currentId } = get();
    if (tracks.length === 0) return;
    if (audio && currentId && audio.currentTime > RESTART_THRESHOLD_S) {
      audio.currentTime = 0;
      return;
    }
    const current = Math.max(indexOf(tracks, currentId), 0);
    get().play(tracks[(current - 1 + tracks.length) % tracks.length]?.id);
  },

  stop: () => {
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    set({ currentId: null, playing: false });
  },
}));
