import type { PieceSymbol } from "chess.js";
import { MOVE_SECONDS } from "../scene/board";

export type AudioSettings = {
  master: number;
  effects: number;
  music: number;
  musicOn: boolean;
};
export const DEFAULT_AUDIO: AudioSettings = {
  master: 0.7,
  effects: 0.85,
  music: 0.24,
  musicOn: false,
};
const VOICES: Record<
  PieceSymbol,
  { frequency: number; weight: number; scrape: number }
> = {
  p: { frequency: 340, weight: 0.55, scrape: 1200 },
  n: { frequency: 230, weight: 0.85, scrape: 1700 },
  b: { frequency: 440, weight: 0.65, scrape: 2200 },
  r: { frequency: 94, weight: 1.4, scrape: 520 },
  q: { frequency: 185, weight: 1, scrape: 1100 },
  k: { frequency: 135, weight: 1.2, scrape: 760 },
};

/** Original, locally synthesized audio: no recordings, downloads or autoplay. */
export class ChessAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private effects?: GainNode;
  private music?: GainNode;
  private reverb?: ConvolverNode;
  private noise?: AudioBuffer;
  private settings: AudioSettings = DEFAULT_AUDIO;
  private enabled = true;
  private timer?: ReturnType<typeof setTimeout>;
  private note = 0;
  private musicSources = new Set<AudioScheduledSourceNode>();

  configure(settings: AudioSettings, enabled: boolean) {
    this.settings = settings;
    this.enabled = enabled;
    if (!this.context) return;
    const now = this.context.currentTime;
    this.master!.gain.setTargetAtTime(enabled ? settings.master : 0, now, 0.05);
    this.effects!.gain.setTargetAtTime(settings.effects, now, 0.05);
    this.music!.gain.setTargetAtTime(settings.music, now, 0.1);
    if (
      enabled &&
      settings.musicOn &&
      !document.hidden &&
      this.context.state === "running"
    )
      this.startMusic();
    else this.stopMusic();
  }
  async unlock() {
    try {
      if (!this.context) {
        const ctx = (this.context = new AudioContext());
        this.master = ctx.createGain();
        this.effects = ctx.createGain();
        this.music = ctx.createGain();
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.ratio.value = 4;
        this.master.connect(compressor);
        compressor.connect(ctx.destination);
        this.effects.connect(this.master);
        this.music.connect(this.master);
        this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const samples = this.noise.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < samples.length; i++) {
          brown = (brown + (Math.random() * 2 - 1) * 0.12) / 1.12;
          samples[i] = brown * 3;
        }
        const impulse = ctx.createBuffer(
          2,
          ctx.sampleRate * 1.6,
          ctx.sampleRate,
        );
        for (let c = 0; c < 2; c++) {
          const d = impulse.getChannelData(c);
          for (let i = 0; i < d.length; i++)
            d[i] =
              (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3) * 0.35;
        }
        this.reverb = ctx.createConvolver();
        this.reverb.buffer = impulse;
        const wet = ctx.createGain();
        wet.gain.value = 0.24;
        this.reverb.connect(wet);
        wet.connect(this.master);
        this.music.connect(this.reverb);
      }
      if (this.context.state === "suspended") await this.context.resume();
      this.configure(this.settings, this.enabled);
    } catch {
      /* The game stays playable when the browser has no audio device. */
    }
  }
  private tone(
    frequency: number,
    start: number,
    duration: number,
    volume: number,
    output: AudioNode,
    pan = 0,
    music = false,
  ) {
    const ctx = this.context!;
    const osc = ctx.createOscillator(),
      gain = ctx.createGain(),
      panner = ctx.createStereoPanner();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, start);
    if (!music)
      osc.frequency.exponentialRampToValueAtTime(
        frequency * 0.62,
        start + duration,
      );
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, volume),
      start + (music ? 0.025 : 0.004),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    panner.pan.value = pan;
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(output);
    osc.start(start);
    osc.stop(start + duration + 0.02);
    if (music) this.musicSources.add(osc);
    osc.onended = () => {
      this.musicSources.delete(osc);
      osc.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
  }
  move(
    piece: PieceSymbol,
    capture: boolean,
    file: number,
    spatial = true,
    material: "wood" | "stone" | "metal" = "wood",
  ) {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running" || !this.enabled || document.hidden)
      return;
    const v = VOICES[piece],
      start = ctx.currentTime + 0.015,
      duration = spatial ? MOVE_SECONDS[piece] : 0.16;
    const pan = (file / 7 - 0.5) * 1.1,
      metal = material === "metal";
    // A soft felt scrape follows the travel, followed by a weighted resonant landing.
    const noise = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      panner = ctx.createStereoPanner();
    noise.buffer = this.noise!;
    noise.loop = true;
    filter.type = "bandpass";
    filter.frequency.value = v.scrape * (material === "stone" ? 0.8 : 1);
    filter.Q.value = 0.6;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.12 * v.weight, start + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    panner.pan.value = pan;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.effects!);
    noise.start(start);
    noise.stop(start + duration + 0.01);
    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
    const landing = start + duration * 0.92;
    this.tone(
      v.frequency * (material === "stone" ? 1.18 : 1),
      landing,
      0.24 + v.weight * 0.09,
      0.21 * v.weight,
      this.effects!,
      pan,
    );
    this.tone(
      v.frequency * (metal ? 3.76 : material === "stone" ? 2.67 : 2.13),
      landing,
      metal ? 0.65 : 0.13,
      metal ? 0.085 : 0.055,
      this.effects!,
      pan,
    );
    this.tone(62, landing, 0.15, 0.09 * v.weight, this.effects!, pan);
    if (capture) {
      this.tone(690, start + 0.04, 0.11, 0.14, this.effects!, -pan);
      this.tone(155, start + 0.07, 0.29, 0.2, this.effects!, -pan);
    }
  }
  preview(material: "wood" | "stone" | "metal" = "wood") {
    void this.unlock().then(() => this.move("r", false, 3, true, material));
  }
  private startMusic() {
    if (this.timer) return;
    const phrase = [
      48, 55, 60, 64, 67, 64, 60, 55, 45, 52, 57, 60, 64, 60, 57, 52, 41, 48,
      53, 57, 60, 57, 53, 48, 43, 50, 55, 59, 62, 59, 55, 50,
    ];
    const next = () => {
      if (
        !this.context ||
        !this.settings.musicOn ||
        !this.enabled ||
        document.hidden
      ) {
        this.stopMusic();
        return;
      }
      const midi = phrase[this.note++ % phrase.length],
        f = 440 * 2 ** ((midi - 69) / 12),
        t = this.context.currentTime + 0.04;
      this.tone(
        f,
        t,
        2.8,
        0.17,
        this.music!,
        Math.sin(this.note * 0.8) * 0.35,
        true,
      );
      this.tone(f * 2, t, 1.6, 0.035, this.music!, 0, true);
      if (this.note % 8 === 1)
        this.tone(f / 2, t, 6, 0.12, this.music!, 0, true);
      this.timer = setTimeout(next, 850);
    };
    next();
  }
  private stopMusic() {
    clearTimeout(this.timer);
    this.timer = undefined;
    for (const node of this.musicSources) {
      try {
        node.stop();
      } catch {
        /* already ended */
      }
    }
    this.musicSources.clear();
  }
  visibility() {
    if (document.hidden) {
      this.stopMusic();
      void this.context?.suspend();
    } else if (this.context) void this.unlock();
  }
  dispose() {
    this.stopMusic();
    void this.context?.close();
    this.context = undefined;
  }
}
