/**
 * A simple Rocket Run autopilot for testing the difficulty curve (tests
 * only, not shipped in the game). It looks about a second ahead, aims for the
 * nearest open gap and taps boost no faster than a quick kid could.
 */

import { seeded } from "../rng";
import {
  newRun,
  obstacleY,
  ROCKET,
  stepRocket,
  stepRun,
  WORLD,
  difficulty,
  type Flight,
  type Live,
  type Pattern,
  type Run,
} from "./logic";

const DT = 1 / 60;
/** Fastest tapping: about 9 taps a second. */
const TAP_GAP = 0.11;
/** How far ahead the pilot looks, in seconds. */
const LOOKAHEAD = 1.1;
/** Extra room the pilot keeps from rocks. */
const MARGIN = 8;

/** Free vertical stretches the rocket could fly through soon. */
function openings(run: Run, speed: number): [number, number][] {
  const blocked: [number, number][] = [];
  for (const o of run.obstacles) {
    const toRocket = (o.x - ROCKET.x) / (speed * o.speedFactor);
    if (toRocket < -0.2 || toRocket > LOOKAHEAD) continue;
    const reach = o.radius + ROCKET.radius + MARGIN;
    // Wobbling rocks block everywhere they could be meanwhile.
    let lo = Infinity;
    let hi = -Infinity;
    for (
      let s = Math.max(0, toRocket - 0.25);
      s <= toRocket + 0.25;
      s += 0.05
    ) {
      const y = obstacleY(o, o.age + s);
      lo = Math.min(lo, y - reach);
      hi = Math.max(hi, y + reach);
    }
    blocked.push([lo, hi]);
  }
  blocked.sort((a, b) => a[0] - b[0]);
  const free: [number, number][] = [];
  let from: number = ROCKET.radius;
  for (const [lo, hi] of blocked) {
    if (lo > from) free.push([from, lo]);
    from = Math.max(from, hi);
  }
  if (from < WORLD.height - ROCKET.radius)
    free.push([from, WORLD.height - ROCKET.radius]);
  return free;
}

/** Where the pilot wants to be: inside the closest opening worth taking. */
function target(run: Run, speed: number): number {
  const y = run.flight.y;
  const all = openings(run, speed);
  if (all.length === 0) return y;
  // Tapping makes the rocket bob, so skip openings too thin to bob in.
  const roomy = all.filter(([lo, hi]) => hi - lo >= 45);
  const free = roomy.length
    ? roomy
    : [all.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a))];
  let best = free[0];
  let bestCost = Infinity;
  for (const gap of free) {
    const centre = (gap[0] + gap[1]) / 2;
    const cost = Math.abs(centre - y) - (gap[1] - gap[0]) * 0.5;
    if (cost < bestCost) {
      bestCost = cost;
      best = gap;
    }
  }
  // Stay well inside the opening, and away from the top and bottom edges.
  const lo = Math.max(best[0], 90);
  const hi = Math.min(best[1], WORLD.height - 90);
  if (hi - lo < 20) return (best[0] + best[1]) / 2;
  const inset = Math.min(55, (hi - lo) / 2);
  return Math.min(Math.max(y, lo + inset), hi - inset);
}

/**
 * Plans a little: tapping now, a bit later, or not at all, and taps only if
 * "now" keeps the rocket closest to the goal over the next half second.
 */
function shouldBoost(flight: Flight, goal: number): boolean {
  const cost = (tapAt: number) => {
    let f = flight;
    let sum = 0;
    for (let i = 0; i < 30; i++) {
      f = stepRocket(f, DT, i === tapAt);
      sum += (f.y - goal) ** 2;
    }
    return sum;
  };
  const now = cost(0);
  return [4, 8, 12, 16, 22, -1].every((later) => now < cost(later));
}

export type FlightReport = {
  survived: boolean;
  seconds: number;
  sector: number;
  /** The obstacle pattern that ended the run, if it ended. */
  killer: Pattern | null;
};

/** Flies a run with the autopilot for up to `maxSeconds`. */
export function autopilot(seed: number, maxSeconds: number): FlightReport {
  const rng = seeded(seed);
  const run = newRun();
  let lastTap = -1;
  while (run.elapsed < maxSeconds) {
    const { speed } = difficulty(run.elapsed);
    let boost = false;
    if (
      run.elapsed - lastTap >= TAP_GAP &&
      shouldBoost(run.flight, target(run, speed))
    ) {
      boost = true;
      lastTap = run.elapsed;
    }
    const { crashed } = stepRun(run, DT, boost, rng);
    if (crashed) return report(run, crashed);
  }
  return report(run, null);
}

function report(run: Run, crashed: Live | null): FlightReport {
  return {
    survived: !crashed,
    seconds: run.elapsed,
    sector: run.sector,
    killer: crashed?.pattern ?? null,
  };
}
