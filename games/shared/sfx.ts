/**
 * Tiny synthesized sound effects (Web Audio): original sounds, no files to
 * download or license. The AudioContext is created on the first sound, which
 * only happens after the player presses Start, so browsers allow it.
 */

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

function tone(
  from: number,
  to: number,
  duration: number,
  type: OscillatorType,
  volume = 0.15,
) {
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(to, now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

/** One chiptune note `start` seconds from now. */
function note(
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = "square",
  volume = 0.06,
) {
  const ctx = audio();
  if (!ctx) return;
  const at = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

/** Notes one after another, `step` seconds apart. */
function jingle(
  freqs: number[],
  step: number,
  type: OscillatorType = "square",
) {
  freqs.forEach((freq, i) => note(freq, i * step, step * 1.6, type));
}

function noise(
  duration: number,
  cutoff: number,
  volume = 0.3,
  type: BiquadFilterType = "lowpass",
  delay = 0,
) {
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime + delay;
  const buffer = ctx.createBuffer(
    1,
    Math.ceil(ctx.sampleRate * duration),
    ctx.sampleRate,
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(cutoff, now);
  if (type === "lowpass") {
    filter.frequency.exponentialRampToValueAtTime(80, now + duration);
  }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(now);
}

export const sfx = {
  boost: () => {
    noise(0.18, 2400, 0.12);
    tone(180, 420, 0.15, "triangle", 0.08);
  },
  crash: () => {
    noise(0.7, 1800, 0.4);
    tone(160, 40, 0.5, "sawtooth", 0.12);
  },
  eat: () => tone(660, 1320, 0.12, "square", 0.07),
  start: () => tone(440, 880, 0.18, "triangle", 0.1),
  /** Foot meets ball: a soft thump. */
  kick: () => {
    tone(150, 50, 0.16, "sine", 0.35);
    noise(0.06, 1200, 0.15);
  },
  /** Bat meets ball: a sharp crack. */
  crack: () => {
    noise(0.07, 2500, 0.45, "highpass");
    tone(1400, 700, 0.08, "square", 0.08);
  },
  whoosh: () => noise(0.25, 900, 0.12, "bandpass"),
  /** A crowd cheering: a few overlapping bursts of filtered noise. */
  cheer: () => {
    for (let i = 0; i < 4; i++)
      noise(1.1, 1400 + i * 300, 0.07, "bandpass", i * 0.12);
    tone(523, 1046, 0.25, "triangle", 0.06);
  },
  /** Menu-style blip (aim locked, power bar starts). */
  blip: () => note(988, 0, 0.06, "square", 0.05),
  /** Ball off the post. */
  clang: () => {
    tone(1250, 980, 0.3, "square", 0.05);
    tone(1870, 1500, 0.25, "triangle", 0.05);
  },
  /** 8-bit victory arpeggio for goals and home runs. */
  fanfare: () => jingle([523, 659, 784, 1047, 784, 1047], 0.08),
  /** Rising chime when Rocket Run enters a new sector. */
  levelUp: () => jingle([392, 523, 659, 784], 0.07, "triangle"),
  /** A friendly "awww" for a miss. */
  aww: () => {
    tone(420, 240, 0.6, "triangle", 0.09);
    noise(0.6, 700, 0.05, "bandpass");
  },
};
