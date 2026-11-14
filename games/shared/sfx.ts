/**
 * Tiny synthesized sound effects (Web Audio): original sounds, no files to
 * download or license. The AudioContext is created on the first sound, which
 * only happens after the player presses Start, so browsers allow it.
 */

let context: AudioContext | null = null;

/** The shared AudioContext (created on first use), or null if unavailable. */
export function audio(): AudioContext | null {
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

  // Star Courier
  hop: () => tone(300, 620, 0.12, "triangle", 0.08),
  /** Moon Boots hop or a bounce off a pod roof. */
  boing: () => {
    tone(180, 720, 0.22, "sine", 0.14);
    tone(360, 900, 0.18, "triangle", 0.05);
  },
  slide: () => noise(0.22, 1600, 0.08, "bandpass"),
  land: () => noise(0.06, 500, 0.08),
  swish: () => noise(0.08, 2600, 0.04, "bandpass"),
  /**
   * Stardust pickup. `streak` counts pickups in a row: each one rings a step
   * higher up a major scale, back to the bottom after a pause.
   */
  stardust: (streak: number) => {
    const steps = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
    const semis = steps[Math.min(streak, steps.length - 1)];
    const f = 880 * 2 ** (semis / 12);
    note(f, 0, 0.09, "square", 0.035);
    note(f * 2, 0.03, 0.06, "triangle", 0.025);
  },
  powerUp: () => jingle([523, 784, 1047, 1319], 0.05, "triangle"),
  powerDown: () => jingle([784, 587, 440], 0.06, "triangle"),
  stumble: () => {
    tone(260, 120, 0.25, "square", 0.07);
    noise(0.15, 900, 0.12);
  },
  /** Bubble Shield pops. */
  pop: () => {
    noise(0.12, 3000, 0.2, "highpass");
    tone(900, 300, 0.15, "sine", 0.1);
  },
  smash: () => {
    noise(0.2, 2200, 0.2);
    tone(700, 1400, 0.1, "square", 0.04);
  },
  // Astro Hop
  jump: () => tone(260, 760, 0.16, "square", 0.045),
  /** Big Clank wakes up: a low, grumpy two-note honk. */
  bossWake: () => {
    note(110, 0, 0.18, "square", 0.07);
    note(98, 0.2, 0.3, "square", 0.07);
    noise(0.15, 400, 0.06);
  },
  /** A stomp or spark lands on Big Clank: a metal clonk. */
  bossHit: () => {
    tone(420, 180, 0.14, "square", 0.08);
    note(1320, 0, 0.08, "triangle", 0.05);
  },
  /** Big Clank powers down: a falling whirr and a sputter. */
  bossDown: () => {
    tone(600, 60, 0.9, "sawtooth", 0.05);
    noise(0.5, 900, 0.06, "bandpass");
  },
  boltToss: () => tone(700, 300, 0.1, "triangle", 0.05),
  /** The power switch clicks off. */
  switchClick: () => {
    noise(0.04, 3000, 0.12, "highpass");
    note(880, 0.03, 0.06, "square", 0.05);
    note(660, 0.1, 0.1, "square", 0.05);
  },
  /** Star coin: a three-note twinkle. */
  coin: () => {
    note(1568, 0, 0.05, "triangle", 0.06);
    note(2093, 0.04, 0.08, "triangle", 0.06);
    note(2637, 0.08, 0.16, "triangle", 0.05);
  },
  stomp: () => {
    tone(520, 120, 0.12, "square", 0.07);
    noise(0.05, 1200, 0.1);
  },
  /** Head meets block. */
  bump: () => tone(150, 90, 0.08, "triangle", 0.22),
  thud: () => tone(110, 70, 0.06, "square", 0.07),
  /** Something rises out of a star block. */
  sprout: () => tone(300, 900, 0.35, "triangle", 0.07),
  oneUp: () => jingle([659, 880, 1047, 1319, 1175, 1568], 0.07, "triangle"),
  spark: () => {
    tone(900, 300, 0.1, "square", 0.04);
    noise(0.05, 4000, 0.05, "highpass");
  },
  /** An enemy knocked out by a shell, spark or bumped block. */
  bonk: () => tone(700, 180, 0.15, "square", 0.06),
  kickShell: () => {
    tone(300, 150, 0.06, "square", 0.08);
    noise(0.04, 2000, 0.12);
  },
  poleSlide: () => tone(1200, 300, 0.9, "triangle", 0.05),
  liftoff: () => {
    noise(1.6, 900, 0.16);
    tone(80, 300, 1.4, "sawtooth", 0.04);
  },
  tick: () => note(1760, 0, 0.03, "square", 0.02),
  hurry: () => jingle([880, 988, 880, 988, 1047], 0.07),
  /** Kit loses a life: a friendly tumble down the scale. */
  oops: () => jingle([523, 494, 466, 440, 392, 330], 0.11, "triangle"),
  gameOverTune: () => jingle([392, 330, 262, 196], 0.22, "triangle"),
  clearTune: () => jingle([523, 659, 784, 1047, 988, 1047, 1319], 0.1),
  // Hide & Seek: Mazes
  footstep: () => noise(0.04, 700, 0.05),
  footRun: () => noise(0.05, 1300, 0.09),
  /** Peeka's little robot wheels; quieter when it's far away. */
  peekaStep: (volume: number) => {
    tone(260, 200, 0.05, "square", 0.02 * volume);
    noise(0.03, 2200, 0.04 * volume, "bandpass");
  },
  /** Slipping into a hiding spot: a soft whoosh and a thunk. */
  hideIn: () => {
    noise(0.18, 1100, 0.08, "bandpass");
    tone(160, 90, 0.12, "sine", 0.15);
  },
  peekOut: () => {
    noise(0.14, 1500, 0.06, "bandpass");
    tone(300, 420, 0.1, "triangle", 0.05);
  },
  /** Peeka heard something: a curious "hmm?" going up. */
  heard: () => {
    note(660, 0, 0.08, "triangle", 0.08);
    note(990, 0.09, 0.14, "triangle", 0.08);
  },
  /** Peeka spotted you: a quick alarm sting. */
  spotted: () => jingle([988, 1319, 988, 1319], 0.06),
  /** A hiding spot creaks open. */
  creakOpen: () => tone(220, 330, 0.3, "sawtooth", 0.025),
  /** Nobody in there: a small two-note "nope". */
  empty: () => {
    note(523, 0, 0.08, "triangle", 0.05);
    note(392, 0.1, 0.12, "triangle", 0.05);
  },
  phew: () => tone(900, 500, 0.35, "sine", 0.06),
  readyOrNot: () => jingle([392, 523, 659, 784], 0.09, "triangle"),
  /** Found! A friendly "gotcha" jingle. */
  found: () => jingle([784, 659, 784, 523, 392], 0.1, "triangle"),

  /** Gloop the jelly gives you a squishy hug. */
  gloop: () => {
    tone(320, 90, 0.5, "sine", 0.22);
    tone(240, 70, 0.6, "triangle", 0.1);
    noise(0.4, 500, 0.08, "bandpass");
  },
};
