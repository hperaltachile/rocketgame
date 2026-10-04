/** Pure Star Slugger (batting) rules: pitches, swing timing and the count. */

import type { Rng } from "../rng";

export type PitchSpeed = "slow" | "medium" | "fast";
export type Pitch = { speed: PitchSpeed; travelMs: number };
export type SwingResult = "homeRun" | "hit" | "foul" | "strike";

/** Time from release to the plate for each pitch, before speed-ups. */
export const BASE_TRAVEL: Record<PitchSpeed, number> = {
  slow: 1500,
  medium: 1150,
  fast: 850,
};

/**
 * How far from perfect a swing can be (ms, early or late) for each result.
 * Generous on purpose: this is for kids.
 */
export const WINDOW = { perfect: 35, good: 90, foul: 160 } as const;

export const POINTS = { hit: 1, homeRun: 4 } as const;
export const STRIKES_PER_OUT = 3;
export const OUTS_PER_GAME = 3;

/** Pitches get up to 25% faster as the score goes up. */
export function speedUp(score: number): number {
  return Math.min(0.25, score * 0.012);
}

/** Chance of each pitch speed: mostly slow at first, more fast ones later. */
export function pitchMix(score: number): Record<PitchSpeed, number> {
  const t = Math.min(1, score / 20);
  const slow = 0.45 - 0.3 * t;
  const fast = 0.15 + 0.3 * t;
  return { slow, medium: 1 - slow - fast, fast };
}

export function nextPitch(score: number, rng: Rng = Math.random): Pitch {
  const mix = pitchMix(score);
  const roll = rng();
  const speed: PitchSpeed =
    roll < mix.slow ? "slow" : roll < mix.slow + mix.medium ? "medium" : "fast";
  return {
    speed,
    travelMs: Math.round(BASE_TRAVEL[speed] * (1 - speedUp(score))),
  };
}

/**
 * Result of a swing `offsetMs` after the ball reached the plate (negative
 * means early). `null` means the batter didn't swing: a strike.
 */
export function judgeSwing(offsetMs: number | null): SwingResult {
  if (offsetMs === null) return "strike";
  const off = Math.abs(offsetMs);
  if (off <= WINDOW.perfect) return "homeRun";
  if (off <= WINDOW.good) return "hit";
  if (off <= WINDOW.foul) return "foul";
  return "strike";
}

export type Count = {
  strikes: number;
  outs: number;
  hits: number;
  homeRuns: number;
  score: number;
};

export const newCount = (): Count => ({
  strikes: 0,
  outs: 0,
  hits: 0,
  homeRuns: 0,
  score: 0,
});

export const isGameOver = (count: Count) => count.outs >= OUTS_PER_GAME;

export function applyResult(count: Count, result: SwingResult): Count {
  if (isGameOver(count)) return count;
  switch (result) {
    case "homeRun":
      return {
        ...count,
        strikes: 0,
        homeRuns: count.homeRuns + 1,
        score: count.score + POINTS.homeRun,
      };
    case "hit":
      return {
        ...count,
        strikes: 0,
        hits: count.hits + 1,
        score: count.score + POINTS.hit,
      };
    case "foul":
      // A foul is a strike, but it can't be strike three.
      return {
        ...count,
        strikes: Math.min(count.strikes + 1, STRIKES_PER_OUT - 1),
      };
    case "strike": {
      const strikes = count.strikes + 1;
      return strikes >= STRIKES_PER_OUT
        ? { ...count, strikes: 0, outs: count.outs + 1 }
        : { ...count, strikes };
    }
  }
}
