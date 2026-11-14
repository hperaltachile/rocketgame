/**
 * A simple Star Courier autopilot for testing the difficulty curve (tests
 * only, not shipped in the game). It looks less than a second ahead, reacts
 * a beat late like a person, and its timing wobbles a little.
 */

import { seeded, type Rng } from "../rng";
import { OBSTACLES } from "./chunks";
import { CONFIG } from "./config";
import {
  isGrounded,
  newRun,
  stepRun,
  type Action,
  type Obstacle,
  type Run,
} from "./logic";

const DT = 1 / 60;
/** How far ahead the pilot notices things, in seconds. */
const LOOKAHEAD = 0.9;
/** Pods and freighters are big: they're noticed from further away. */
const LOOKAHEAD_TALL = 1.1;
/** Seconds between decisions (a quick kid, not a robot). */
const THINK_EVERY = 0.09;
/** Timing wobble on jumps and slides, in seconds (standard deviation). */
const WOBBLE = 0.09;
/** Seconds from something coming into view to reacting to it. */
const REACTION = { mean: 0.42, spread: 0.18, min: 0.14 };

/** Where the player will meet an obstacle, measured from the player. */
function meetsAt(run: Run, o: Obstacle): number {
  const ahead = o.z - run.distance;
  if (o.kind !== "freighter") return ahead;
  const v = run.speed;
  const vF = CONFIG.freighterSpeed;
  if (o.awake) return (ahead * v) / (v + vF);
  return ahead - (CONFIG.freighterWake * vF) / (v + vF);
}

/**
 * Plans a route through the tall obstacles the pilot has noticed (the same
 * idea as `routeExists` in chunks.ts) and returns the first lane move of the
 * route that gets furthest: -1 (left), +1 (right) or 0 (stay).
 */
function plan(run: Run, noticed: (o: Obstacle) => boolean): number {
  const STEP = 0.5;
  const steps = 120; // 60 m
  const v = run.speed;
  const vF = CONFIG.freighterSpeed;
  const blocked: [number, number][][] = [[], [], []];
  for (const o of run.obstacles) {
    if (o.hit || !OBSTACLES[o.kind].tall || !noticed(o)) continue;
    const depth =
      o.kind === "freighter"
        ? (OBSTACLES.freighter.depth * v) / (v + vF)
        : OBSTACLES[o.kind].depth;
    const at = meetsAt(run, o);
    blocked[o.lane].push([at - 1, at + depth + 1]);
  }
  const open = (lane: number, i: number) =>
    !blocked[lane].some(([lo, hi]) => i * STEP >= lo && i * STEP <= hi);
  const sw = Math.ceil((v * CONFIG.laneTime + 1.5) / STEP);
  const lane0 = run.player.lane;
  type Cell = { first: number; firstAt: number } | null;
  const reach: Cell[][] = [
    [0, 1, 2].map((l) => (l === lane0 ? { first: 0, firstAt: 0 } : null)),
  ];
  let last = 0;
  for (let i = 1; i <= steps; i++) {
    const row: Cell[] = [null, null, null];
    for (let l = 0; l < 3; l++) {
      if (!open(l, i)) continue;
      const stay = reach[i - 1][l];
      if (stay) {
        row[l] = stay;
        continue;
      }
      if (i < sw) continue;
      for (const n of [l - 1, l + 1]) {
        const from = n >= 0 && n <= 2 ? reach[i - sw][n] : null;
        if (!from) continue;
        let clear = true;
        for (let j = i - sw; j <= i && clear; j++)
          clear = open(l, j) && open(n, j);
        if (!clear) continue;
        const cell = from.first
          ? from
          : { first: Math.sign(l - n), firstAt: i - sw };
        if (!row[l] || cell.firstAt < row[l]!.firstAt) row[l] = cell;
      }
    }
    if (row.every((c) => !c)) break;
    reach.push(row);
    last = i;
  }
  const ends = reach[last].filter((c): c is NonNullable<Cell> => !!c);
  if (ends.length === 0 || ends.some((c) => c.first === 0)) return 0;
  const best = ends.reduce((a, b) => (b.firstAt < a.firstAt ? b : a));
  // Only move once the route says now; until then the next lane may be busy.
  return best.firstAt <= 2 ? best.first : 0;
}

function gaussian(rng: Rng): number {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}

export type RunReport = {
  survived: boolean;
  seconds: number;
  distance: number;
  sector: number;
  how: Run["over"];
  /** What ended the run, and whether you were moving between lanes. */
  killer: string | null;
};

/** Plays a run with the autopilot for up to `maxSeconds`. */
export function autopilot(
  seed: number,
  maxSeconds: number,
  trace?: (run: Run, actions: readonly Action[]) => void,
): RunReport {
  const rng = seeded(seed);
  const pilot = seeded(seed * 7919 + 1);
  const run = newRun();
  let nextThink = 0;
  /** Planned jump or slide: when to press, and for which obstacle. */
  let planned: { at: number; action: Action; id: number } | null = null;
  const handled = new Set<number>();
  /** When the pilot has taken in each obstacle (after a reaction time). */
  const noticedAt = new Map<number, number>();
  const noticed = (o: Obstacle) =>
    (noticedAt.get(o.id) ?? Infinity) <= run.elapsed;

  while (run.elapsed < maxSeconds && !run.over) {
    const actions: Action[] = [];
    const p = run.player;
    const v = run.speed;

    const seen = v * LOOKAHEAD;
    for (const o of run.obstacles) {
      const view = OBSTACLES[o.kind].tall ? v * LOOKAHEAD_TALL : seen;
      if (!noticedAt.has(o.id) && meetsAt(run, o) <= view) {
        // A whole row is taken in at once, after one reaction time.
        const r = REACTION.mean + gaussian(pilot) * REACTION.spread;
        const at = run.elapsed + Math.max(REACTION.min, r);
        for (const other of run.obstacles)
          if (!noticedAt.has(other.id) && Math.abs(other.z - o.z) < 1)
            noticedAt.set(other.id, at);
      }
    }
    if (run.elapsed >= nextThink) {
      nextThink = run.elapsed + THINK_EVERY;
      // Change lanes when the planned route says so.
      if (p.laneT >= 1) {
        const move = plan(run, noticed);
        if (move !== 0) {
          actions.push(move < 0 ? "left" : "right");
          planned = null;
        }
      }
      // Plan a jump or slide for the next small obstacle in this lane.
      if (!planned) {
        let next: Obstacle | null = null;
        for (const o of run.obstacles) {
          if (o.lane !== p.lane || o.hit || handled.has(o.id)) continue;
          if (!noticed(o)) continue;
          if (OBSTACLES[o.kind].tall) continue;
          const ahead = o.z - run.distance;
          if (ahead < 0 || ahead > seen) continue;
          if (!next || o.z < next.z) next = o;
        }
        if (next) {
          const ahead = next.z - run.distance;
          // Press so you're in the air (or low) right as it goes by: the
          // middle of the window, worked out from the jump and slide.
          const lead =
            next.kind === "gate"
              ? 0.325 - 0.25 / v
              : next.kind === "gap"
                ? 0.3165 - 1.5 / v
                : 0.3165 - 0.6 / v;
          const wait = Math.max(
            0,
            (ahead - lead * v) / v + gaussian(pilot) * WOBBLE,
          );
          planned = {
            at: run.elapsed + wait,
            action: next.kind === "gate" ? "down" : "up",
            id: next.id,
          };
        }
      }
    }
    if (planned && run.elapsed >= planned.at) {
      if (planned.action === "down" || isGrounded(p)) {
        actions.push(planned.action);
        handled.add(planned.id);
        planned = null;
      }
    }
    trace?.(run, actions);
    stepRun(run, DT, rng, actions);
  }
  return {
    survived: !run.over,
    seconds: run.elapsed,
    distance: run.distance,
    sector: run.sector,
    how: run.over,
    killer: run.over
      ? (run.obstacles
          .filter((o) => o.hit)
          .sort(
            (a, b) =>
              Math.abs(a.z - run.distance) - Math.abs(b.z - run.distance),
          )
          .map((o) => `${o.kind}${run.player.laneT < 1 ? "-side" : ""}`)[0] ??
        null)
      : null,
  };
}
