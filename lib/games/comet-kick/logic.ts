/**
 * Pure Comet Kick (penalty kick) rules. Goal coordinates: x from -1 (left
 * post) to 1 (right post), y from 0 (ground) to 1 (crossbar).
 */

import type { Rng } from "../rng";

export type Difficulty = "easy" | "medium" | "hard";
export type GoalPoint = { x: number; y: number };
export type Outcome = "goal" | "saved" | "over" | "wide" | "post";

export const KICKS = 5;

/** Power bar zones (0..1): weak below `good`, wild above `strong`. */
export const POWER = { good: 0.45, strong: 0.8, wild: 0.92 } as const;

type KeeperSkill = {
  /** Chance of guessing the shot's zone on the first kick. */
  read: number;
  /** How far (goal units) from where he lands he can still stop the ball. */
  reach: number;
  /** Seconds for a full power-bar sweep up and down (shorter = harder). */
  sweep: number;
};

export const KEEPER: Record<Difficulty, KeeperSkill> = {
  easy: { read: 0.15, reach: 0.24, sweep: 1.8 },
  medium: { read: 0.3, reach: 0.3, sweep: 1.45 },
  hard: { read: 0.45, reach: 0.36, sweep: 1.15 },
};

/** The goalie gets a little sharper with every kick of the round. */
export const READ_PER_KICK = 0.06;

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** Keeps the aim marker inside the goal mouth. */
export function clampAim(aim: GoalPoint): GoalPoint {
  return { x: clamp(aim.x, -0.95, 0.95), y: clamp(aim.y, 0.05, 0.95) };
}

/** Power bar level at `t` seconds: sweeps 0 → 1 → 0 every `sweep` seconds. */
export function powerAt(t: number, sweep: number): number {
  const phase = (((t / sweep) % 1) + 1) % 1;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

/** The six places the goalie can dive: left/middle/right × low/high. */
export function zoneCenter(col: -1 | 0 | 1, high: boolean): GoalPoint {
  return { x: col * 0.62, y: high ? 0.68 : 0.22 };
}

export function zoneOf(aim: GoalPoint): { col: -1 | 0 | 1; high: boolean } {
  const col = aim.x < -1 / 3 ? -1 : aim.x > 1 / 3 ? 1 : 0;
  return { col, high: aim.y >= 0.5 };
}

/**
 * Where the goalie dives. Sometimes he reads the shot (more often on harder
 * levels and later kicks), otherwise he guesses a random zone.
 */
export function keeperDive(
  aim: GoalPoint,
  difficulty: Difficulty,
  kick: number,
  rng: Rng = Math.random,
): GoalPoint {
  const read = KEEPER[difficulty].read + kick * READ_PER_KICK;
  if (rng() < read) {
    const zone = zoneOf(aim);
    return zoneCenter(zone.col, zone.high);
  }
  const col = (Math.floor(rng() * 3) - 1) as -1 | 0 | 1;
  return zoneCenter(col, rng() < 0.5);
}

/**
 * Where the ball actually goes. A good-power shot goes where you aimed; a
 * very hard one flies higher and wider, and a red-zone one usually over.
 */
export function shotLanding(
  aim: GoalPoint,
  power: number,
  rng: Rng = Math.random,
): GoalPoint {
  const extra = Math.max(0, power - POWER.strong);
  const spread = 0.03 + extra * 0.6;
  // Into the red zone, the ball rises a lot: usually over the bar.
  const lift = extra * 1.2 + (power > POWER.wild ? 0.6 : 0);
  return {
    x: aim.x + (rng() * 2 - 1) * spread,
    y: aim.y + (rng() * 2 - 1) * spread * 0.5 + lift,
  };
}

/** Decides a kick: where the ball goes and whether it's a goal. */
export function resolveShot(
  shot: { aim: GoalPoint; power: number },
  dive: GoalPoint,
  difficulty: Difficulty,
  rng: Rng = Math.random,
): { outcome: Outcome; landing: GoalPoint } {
  const landing = shotLanding(shot.aim, shot.power, rng);
  const ax = Math.abs(landing.x);
  if (landing.y > 1.04) return { outcome: "over", landing };
  if (ax > 1.04) return { outcome: "wide", landing };
  if (ax > 0.97 || landing.y > 0.97) return { outcome: "post", landing };

  // A weak shot is slow, so the goalie gets to more of the goal.
  const slow = Math.max(0, POWER.good - shot.power) * 1.2;
  const reach = KEEPER[difficulty].reach + slow;
  const distance = Math.hypot(landing.x - dive.x, landing.y - dive.y);
  return { outcome: distance <= reach ? "saved" : "goal", landing };
}

export type Round = { results: Outcome[] };

export const newRound = (): Round => ({ results: [] });

export const goals = (round: Round) =>
  round.results.filter((r) => r === "goal").length;

export const kicksTaken = (round: Round) => round.results.length;

export const isRoundOver = (round: Round) => round.results.length >= KICKS;

export function recordKick(round: Round, outcome: Outcome): Round {
  if (isRoundOver(round)) return round;
  return { results: [...round.results, outcome] };
}
