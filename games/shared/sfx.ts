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

function noise(duration: number, cutoff: number, volume = 0.3) {
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime;
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
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, now);
  filter.frequency.exponentialRampToValueAtTime(80, now + duration);
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
};
