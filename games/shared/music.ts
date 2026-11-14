/**
 * A tiny looping chiptune player (Web Audio). It plays a melody and a bass
 * line from simple settings (tempo, scale, note steps), so every tune is
 * original and nothing is downloaded. Notes are scheduled a little ahead
 * with the audio clock, so the beat stays steady even if a frame is slow.
 */

import { audio } from "./sfx";

export type Tune = {
  bpm: number;
  root: number;
  scale: number[];
  lead: OscillatorType;
  bass: OscillatorType;
  melody: number[];
  bassline: number[];
};

const LOOKAHEAD = 0.15; // seconds of notes scheduled ahead
const TICK_MS = 50;

export class Music {
  private tune: Tune | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private gain: GainNode | null = null;
  private nextAt = 0;
  private step = 0;

  /** Starts (or switches to) a tune. Safe to call when audio is blocked. */
  play(tune: Tune, volume = 0.5) {
    const ctx = audio();
    if (!ctx) return;
    this.stop();
    this.tune = tune;
    this.gain = ctx.createGain();
    this.gain.gain.value = volume;
    this.gain.connect(ctx.destination);
    this.nextAt = ctx.currentTime + 0.05;
    this.step = 0;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  /** Fades out and stops. */
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const ctx = audio();
    if (this.gain && ctx) {
      const g = this.gain;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => g.disconnect(), 400);
    }
    this.gain = null;
  }

  get playing() {
    return this.timer !== null;
  }

  private freq(step: number, octave = 0) {
    const t = this.tune!;
    const n = t.scale.length;
    const index = ((step % n) + n) % n;
    const semis = t.scale[index] + 12 * (Math.floor(step / n) + octave);
    return t.root * 2 ** (semis / 12);
  }

  private voice(
    freq: number,
    at: number,
    length: number,
    type: OscillatorType,
    volume: number,
  ) {
    const ctx = audio();
    if (!ctx || !this.gain) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(volume, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(env).connect(this.gain);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }

  private schedule() {
    const ctx = audio();
    const t = this.tune;
    if (!ctx || !t) return;
    const eighth = 30 / t.bpm;
    while (this.nextAt < ctx.currentTime + LOOKAHEAD) {
      const i = this.step;
      const m = t.melody[i % t.melody.length];
      if (m >= 0)
        this.voice(this.freq(m), this.nextAt, eighth * 0.9, t.lead, 0.05);
      if (i % 2 === 0) {
        const b = t.bassline[(i / 2) % t.bassline.length];
        this.voice(this.freq(b, -2), this.nextAt, eighth * 1.8, t.bass, 0.09);
      }
      // A soft tick on the off-beats keeps the groove going.
      if (i % 2 === 1)
        this.voice(this.freq(0, 2), this.nextAt, 0.03, "square", 0.012);
      this.nextAt += eighth;
      this.step++;
    }
  }
}
