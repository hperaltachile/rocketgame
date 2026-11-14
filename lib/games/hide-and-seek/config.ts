/**
 * Every tuning number for Hide & Seek: Mazes. Distances are in art pixels
 * (one tile is TILE art pixels), times in seconds.
 */

/** Art pixels per tile. */
export const TILE = 16;

/** Fixed simulation step. */
export const STEP = 1 / 60;

/** What the camera shows, in art pixels (like Astro Hop). */
export const VIEW_W = 360;
export const VIEW_H = 240;

export const ROUND = {
  /** Seconds to stay hidden. */
  duration: 105,
  /** Peeka counts with eyes covered while the player runs off to hide. */
  headStart: 10,
  /** "You stayed hidden!" banner before the next round. */
  wonPause: 3.5,
  /** The "Found you!" reveal before the game-over screen. */
  caughtPause: 1.8,
} as const;

export const PLAYER = {
  radius: 5,
  walk: 62,
  run: 96,
  /** How close (art px from the player's centre to the furniture) Hide works. */
  reach: 12,
  /** Hiding or leaving a spot takes this long. */
  transition: 0.35,
  /** Seconds between footstep noises while running. */
  stepEvery: 0.3,
  /** Noise radius in tiles. */
  runNoise: 5.5,
  bumpNoise: 7,
  /** Hiding and peeking out make a tiny creak. */
  creakNoise: 2.5,
  /** Seconds between bump events. */
  bumpCooldown: 0.7,
} as const;

/**
 * Peeka, the seeker robot. Each value eases from `base` (round 1) toward
 * `cap` as rounds are won: cap − (cap − base)·e^(−rounds/EASE).
 */
const SEEKER_CURVE = {
  /** Art px per second while looking around. */
  speed: { base: 40, cap: 56 },
  /** Art px per second while chasing (the player can still outrun it by running). */
  chaseSpeed: { base: 74, cap: 88 },
  /** Vision range in tiles. */
  range: { base: 5.5, cap: 7.5 },
  /** Full width of the flashlight cone, in degrees. */
  fov: { base: 70, cap: 96 },
  /** Seconds before reacting to a sound. */
  reaction: { base: 0.9, cap: 0.4 },
  /** Seconds of steady sight (at the edge of range) before the chase starts. */
  glimpse: { base: 0.85, cap: 0.5 },
  /** Seconds spent opening and checking one hiding spot. */
  inspect: { base: 1.1, cap: 0.8 },
  /** Chance-weight multiplier for checking each spot in a room (× its suspicion). */
  thorough: { base: 0.72, cap: 1.05 },
  /** Seconds a checked spot stays "remembered" (shorter = rechecks sooner). */
  memory: { base: 42, cap: 24 },
  /** Hearing range multiplier. */
  hearing: { base: 1, cap: 1.45 },
  /** Extra weight per time the player hid in a spot in earlier rounds. */
  learning: { base: 0.5, cap: 1.4 },
} as const;

const EASE = 3;

export type SeekerTuning = {
  -readonly [K in keyof typeof SEEKER_CURVE]: number;
};

export function seekerTuning(roundsWon: number): SeekerTuning {
  const out = {} as SeekerTuning;
  for (const key of Object.keys(SEEKER_CURVE) as (keyof SeekerTuning)[]) {
    const { base, cap } = SEEKER_CURVE[key];
    out[key] = cap - (cap - base) * Math.exp(-roundsWon / EASE);
  }
  return out;
}

export const SEEKER = {
  radius: 5,
  /** Glimpse meter level that makes Peeka suspicious ("?"). */
  suspiciousAt: 0.3,
  /** Glimpse meter drain per second without sight. */
  glimpseDecay: 0.6,
  /** Touching distance for a catch (art px). */
  catchDistance: 10,
  /** Pause at doorways and room centres. */
  doorPause: 0.5,
  /** Seconds to sweep the flashlight around on arriving in a room. */
  lookAround: 1.4,
  /** Spots within this many tiles of a clue get searched. */
  clueRadius: 5,
  /** Max spots searched around a clue. */
  clueChecks: 3,
  /** Turn speed (radians per second). */
  turn: 6,
  /** A clue older than this is stale. */
  clueLife: 12,
} as const;

export const POINTS = {
  /** Per second survived (whole seconds, counted while the timer runs). */
  second: 10,
  roundWon: 500,
  /** Peeka came within 2 tiles of your spot and left without finding you. */
  closeCall: 50,
} as const;

/** A close call: Peeka within this many tiles of your spot, then leaves past `closeCallClear`. */
export const CLOSE_CALL_NEAR = 2;
export const CLOSE_CALL_CLEAR = 4;

/** Exiting is risky if Peeka is within this many tiles or can see the spot. */
export const RISK_NEAR = 4;
