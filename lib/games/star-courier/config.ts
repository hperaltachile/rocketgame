/**
 * Star Courier tuning: every number that changes how the game feels lives
 * here. Distances are in metres, times in seconds.
 *
 * To make the game easier or harder, start with `speed`, `chunkGap` and the
 * sector table in `chunks.ts`, then run `npm test`: the autopilot tests in
 * `logic.test.ts` check that the curve still suits a decent kid.
 */
export const CONFIG = {
  /** Distance between lane centres. */
  laneWidth: 2.2,
  /** Seconds a lane change takes (eased). */
  laneTime: 0.14,

  speed: {
    /** Running speed at the start (m/s). */
    start: 11,
    /** Speed the run eases toward and never passes. */
    max: 27,
    /** Seconds to cover ~63% of the way from `start` to `max`. */
    ramp: 55,
  },

  /** Empty track between two chunks: starts roomy, eases down to `min`. */
  chunkGap: { start: 12, min: 1, ramp: 60 },

  /** Downward pull (m/s²). */
  gravity: 30,
  /** Upward speed of a jump: about 1.5 m high, 0.65 s in the air. */
  jumpVelocity: 9.5,
  /** Speed of the quick drop when you slide in mid-air. */
  dropVelocity: 22,
  /** How long a slide lasts. */
  slideTime: 0.65,
  /** A move pressed this early still happens when it becomes possible. */
  bufferTime: 0.2,

  player: {
    /** Half the player's width, for side contact. */
    halfWidth: 0.4,
    /** Half the player's depth along the track. */
    halfDepth: 0.3,
    height: 1.7,
    slideHeight: 0.8,
  },

  /** A second stumble within this many seconds means Gloop catches you. */
  stumbleWindow: 4,
  /** Short safe time after a stumble or a shield pop, so one bump is one bump. */
  graceTime: 0.7,

  /** How far behind Gloop is: close at the start and after a stumble. */
  gloop: { near: 2.5, far: 16, /** Seconds to drift back. */ driftTime: 3 },

  /** Parked pods and freighters start moving this far ahead of you. */
  freighterWake: 70,
  /** How fast freighters come toward you (m/s). */
  freighterSpeed: 9,

  /** Chunks are laid out this far ahead of the player. */
  spawnAhead: 140,
  /** Things this far behind the player are recycled. */
  despawnBehind: 12,

  /** Distance between stardust in a line. */
  stardustSpacing: 2,
  /** Points per metre run (before multipliers). */
  pointsPerMetre: 1,
  /** At least this far between two power-ups. */
  powerUpSpacing: 220,

  powerUps: {
    /** Seconds each power-up lasts at upgrade level 0, and per upgrade level. */
    warp: { time: 4, perLevel: 0.75 },
    magnet: { time: 9, perLevel: 1.5 },
    boots: { time: 9, perLevel: 1.5 },
    twin: { time: 12, perLevel: 2 },
    shield: { time: 20, perLevel: 3 },
  },
  /** Warp Dash runs this much faster than normal. */
  warpSpeedFactor: 1.6,
  /** Star Magnet pulls stardust this far ahead, from every lane. */
  magnetReach: 9,
  /** Moon Boots: lighter gravity and a bigger hop, enough to clear pods. */
  boots: { gravityFactor: 0.5, jumpVelocity: 11.5 },
} as const;

export type PowerUpKind = keyof typeof CONFIG.powerUps;

export const POWER_UPS: readonly PowerUpKind[] = [
  "warp",
  "magnet",
  "boots",
  "twin",
  "shield",
];

/** Seconds a power-up lasts at an upgrade level (0 = not upgraded). */
export function powerUpTime(kind: PowerUpKind, level = 0): number {
  const p = CONFIG.powerUps[kind];
  return p.time + p.perLevel * Math.max(0, level);
}

/** A value that eases from `start` toward `end` (exponential approach). */
export function ease(start: number, end: number, ramp: number, t: number) {
  return end + (start - end) * Math.exp(-Math.max(0, t) / ramp);
}

/** Running speed after `elapsed` seconds. */
export function speedAt(elapsed: number): number {
  const s = CONFIG.speed;
  return ease(s.start, s.max, s.ramp, elapsed);
}

/** Empty track before the next chunk after `elapsed` seconds. */
export function chunkGapAt(elapsed: number): number {
  const g = CONFIG.chunkGap;
  return ease(g.start, g.min, g.ramp, elapsed);
}
