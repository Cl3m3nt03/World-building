import { assetUrl } from "@/lib/assets";

/** The fade of an ambience, in seconds, when it starts and when it stops. */
const FADE_S = 1.5;

/**
 * The sound of the reading (Web Audio API, ADR 0001): effects played once,
 * ambiences faded in and out, a general volume. Sounds are read once and
 * decoded; one that cannot be read is skipped.
 */
export class SoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private ambiences = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();
  private effects = new Set<AudioBufferSourceNode>();
  private volume = 1;
  private muted = false;

  private audio(): { context: AudioContext; master: GainNode } {
    if (!this.context || !this.master) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.context.destination);
    }
    return { context: this.context, master: this.master };
  }

  private load(assetId: string): Promise<AudioBuffer | null> {
    let buffer = this.buffers.get(assetId);
    if (!buffer) {
      const { context } = this.audio();
      buffer = fetch(assetUrl(assetId))
        .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject()))
        .then((bytes) => context.decodeAudioData(bytes))
        .catch(() => null);
      this.buffers.set(assetId, buffer);
    }
    return buffer;
  }

  /** Reads the sounds ahead, so that they start on time. */
  preload(assetIds: string[]) {
    for (const id of assetIds) void this.load(id);
  }

  /** The ambiences heard now (their sounds' ids). */
  playing(): Set<string> {
    return new Set(this.ambiences.keys());
  }

  async effect(assetId: string, volume: number) {
    const buffer = await this.load(assetId);
    if (!buffer) return;
    const { context, master } = this.audio();
    const gain = context.createGain();
    gain.gain.value = volume / 100;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain).connect(master);
    source.onended = () => this.effects.delete(source);
    this.effects.add(source);
    source.start();
  }

  async startAmbience(id: string, assetId: string, volume: number, looped: boolean) {
    if (this.ambiences.has(id)) return;
    const { context, master } = this.audio();
    const gain = context.createGain();
    gain.gain.value = 0;
    const source = context.createBufferSource();
    // Kept at once: a stop asked while the file loads is not missed.
    this.ambiences.set(id, { source, gain });
    const buffer = await this.load(assetId);
    if (!buffer || this.ambiences.get(id)?.source !== source) return;
    source.buffer = buffer;
    source.loop = looped;
    source.connect(gain).connect(master);
    const now = context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume / 100, now + FADE_S);
    source.start();
  }

  stopAmbience(id: string) {
    const playing = this.ambiences.get(id);
    if (!playing || !this.context) return;
    this.ambiences.delete(id);
    const now = this.context.currentTime;
    playing.gain.gain.cancelScheduledValues(now);
    playing.gain.gain.setValueAtTime(playing.gain.gain.value, now);
    playing.gain.gain.linearRampToValueAtTime(0, now + FADE_S);
    try {
      playing.source.stop(now + FADE_S);
    } catch {
      // Never started (its file could not be read).
    }
  }

  /** Pauses every sound where it is, or goes on. */
  async pause(paused: boolean) {
    if (!this.context) return;
    if (paused) await this.context.suspend();
    else await this.context.resume();
  }

  setVolume(volume: number, muted: boolean) {
    this.volume = volume / 100;
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.context.currentTime, 0.05);
    }
  }

  /** Stops every sound at once (the reading goes back, or is left). */
  stopAll() {
    for (const source of this.effects) {
      try {
        source.stop();
      } catch {
        // Already over.
      }
    }
    this.effects.clear();
    for (const { source } of this.ambiences.values()) {
      try {
        source.stop();
      } catch {
        // Never started.
      }
    }
    this.ambiences.clear();
  }

  close() {
    this.stopAll();
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.buffers.clear();
  }
}
