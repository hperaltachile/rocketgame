import { describe, expect, it } from "vitest";
import { seeded } from "../rng";
import { autopilot, type RunReport } from "./autopilot";
import {
  BREATHER,
  CHUNKS,
  OBSTACLES,
  SECTORS,
  chunkCells,
  coinPositions,
  laneBlocked,
  routeExists,
  sectorAt,
  type Chunk,
} from "./chunks";
import { CONFIG, POWER_UPS, chunkGapAt, powerUpTime, speedAt } from "./config";
import {
  isGrounded,
  multiplier,
  newRun,
  pickChunk,
  placeChunk,
  playerX,
  stepRun,
  laneX,
  type Action,
  type Obstacle,
  type Run,
} from "./logic";

const DT = 1 / 60;
const rng = seeded(1);

/** A run with no track (nothing spawns), for testing moves and bumps. */
function emptyRun(): Run {
  const run = newRun();
  run.nextChunkAt = Infinity;
  return run;
}

function step(run: Run, seconds: number, actions: Action[] = []) {
  stepRun(run, DT, rng, actions);
  for (let t = DT; t < seconds; t += DT) stepRun(run, DT, rng);
}

function put(
  run: Run,
  kind: Obstacle["kind"],
  lane: number,
  ahead: number,
): Obstacle {
  const o: Obstacle = {
    id: run.nextId++,
    kind,
    lane,
    z: run.distance + ahead,
    awake: false,
    hit: false,
    smashed: false,
    wasAlongside: false,
    wasInLane: false,
    wasClear: true,
  };
  run.obstacles.push(o);
  return o;
}

describe("speed and spacing", () => {
  it("start gentle, ease toward a cap and never jump", () => {
    expect(speedAt(0)).toBe(CONFIG.speed.start);
    let last = speedAt(0);
    for (let t = 1; t < 600; t++) {
      const s = speedAt(t);
      expect(s).toBeGreaterThanOrEqual(last);
      expect(s - last).toBeLessThan(0.35);
      expect(s).toBeLessThanOrEqual(CONFIG.speed.max);
      last = s;
    }
    expect(speedAt(600)).toBeGreaterThan(CONFIG.speed.max * 0.95);
    expect(chunkGapAt(0)).toBe(CONFIG.chunkGap.start);
    expect(chunkGapAt(900)).toBeGreaterThanOrEqual(CONFIG.chunkGap.min);
  });

  it("power-ups last longer with upgrades", () => {
    for (const kind of POWER_UPS) {
      expect(powerUpTime(kind, 2)).toBeGreaterThan(powerUpTime(kind, 0));
    }
  });
});

describe("chunks", () => {
  const all: Chunk[] = [...CHUNKS, BREATHER];

  it("have unique ids and three-lane rows", () => {
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    for (const c of all)
      for (const row of c.rows) {
        expect(row.lanes).toMatch(/^[.cgoPF*]{3}$/);
        expect(row.at).toBeGreaterThanOrEqual(6);
        expect(row.at).toBeLessThanOrEqual(c.length);
      }
  });

  it("start and end with every lane open, so they chain", () => {
    for (const c of all)
      for (let lane = 0; lane < 3; lane++) {
        expect(laneBlocked(c, lane, 0), c.id).toBe(false);
        expect(laneBlocked(c, lane, c.length), c.id).toBe(false);
      }
  });

  it("can be passed from every lane", () => {
    for (const c of all)
      for (let lane = 0; lane < 3; lane++)
        expect(routeExists(c, lane), `${c.id} from lane ${lane}`).toBe(true);
  });

  it("never leave all three lanes blocked at once", () => {
    for (const c of all)
      for (let z = 0; z <= c.length; z += 0.5)
        expect(
          [0, 1, 2].some((l) => !laneBlocked(c, l, z)),
          `${c.id} at ${z}`,
        ).toBe(true);
  });

  it("leave room to land between two jumps or slides in a lane", () => {
    for (const c of all) {
      const small = chunkCells(c).filter(
        (cell) => cell.kind !== "power" && !OBSTACLES[cell.kind].tall,
      );
      for (const a of small)
        for (const b of small)
          if (a !== b && a.lane === b.lane && b.at > a.at)
            expect(b.at - a.at, c.id).toBeGreaterThanOrEqual(10);
    }
  });

  it("don't put stardust inside pods or freighters", () => {
    for (const c of all)
      for (const coins of c.coins)
        for (const pos of coinPositions(coins, CONFIG.stardustSpacing))
          expect(laneBlocked(c, coins.lane, pos.at), c.id).toBe(false);
  });

  it("every sector brings something new", () => {
    for (let s = 0; s < SECTORS.length; s++)
      expect(CHUNKS.some((c) => c.minSector === s)).toBe(true);
    expect(sectorAt(0)).toBe(0);
    expect(sectorAt(SECTORS[2].at + 1)).toBe(2);
  });

  it("are only picked once their sector is reached", () => {
    const r = seeded(4);
    for (let i = 0; i < 300; i++) {
      expect(pickChunk(1, r).minSector).toBeLessThanOrEqual(1);
    }
  });
});

describe("moves", () => {
  it("lane changes slide smoothly into the next lane", () => {
    const run = emptyRun();
    step(run, CONFIG.laneTime / 2, ["left"]);
    expect(run.player.lane).toBe(0);
    expect(playerX(run.player)).toBeLessThan(0);
    expect(playerX(run.player)).toBeGreaterThan(laneX(0));
    step(run, CONFIG.laneTime);
    expect(playerX(run.player)).toBeCloseTo(laneX(0));
    step(run, 0.1, ["left"]); // already at the edge
    expect(run.player.lane).toBe(0);
  });

  it("jumps go up and come back down", () => {
    const run = emptyRun();
    step(run, 0.2, ["up"]);
    expect(run.player.y).toBeGreaterThan(1);
    step(run, 1);
    expect(isGrounded(run.player)).toBe(true);
    expect(run.stats.jumps).toBe(1);
  });

  it("remembers a jump pressed just before landing", () => {
    const run = emptyRun();
    step(run, 0.55, ["up"]);
    expect(run.player.y).toBeGreaterThan(0);
    step(run, 0.15, ["up"]);
    expect(run.stats.jumps).toBe(2);
  });

  it("forgets a jump pressed much too early", () => {
    const run = emptyRun();
    step(run, 0.1, ["up"]);
    step(run, 0.8, ["up"]);
    expect(run.stats.jumps).toBe(1);
  });

  it("down in mid-air drops fast, then slides", () => {
    const run = emptyRun();
    step(run, 0.2, ["up"]);
    const slow = emptyRun();
    step(slow, 0.2, ["up"]);
    step(run, 0.1, ["down"]);
    step(slow, 0.1);
    expect(run.player.y).toBeLessThan(slow.player.y);
    step(run, 0.1);
    expect(run.player.slide).toBeGreaterThan(0);
  });
});

describe("bumps", () => {
  it("jumping clears a crate, running into it is a stumble", () => {
    const ok = emptyRun();
    put(ok, "crate", 1, ok.speed * 0.28);
    step(ok, 0.05, ["up"]);
    step(ok, 1);
    expect(ok.stats.stumbles).toBe(0);

    const bump = emptyRun();
    put(bump, "crate", 1, 3);
    step(bump, 1);
    expect(bump.stats.stumbles).toBe(1);
    expect(bump.over).toBeNull();
  });

  it("sliding gets under a gate", () => {
    const run = emptyRun();
    put(run, "gate", 1, run.speed * 0.25);
    step(run, 0.05, ["down"]);
    step(run, 1);
    expect(run.stats.stumbles).toBe(0);
  });

  it("a second stumble soon after means Gloop catches you", () => {
    const run = emptyRun();
    put(run, "crate", 1, 3);
    put(run, "crate", 1, 3 + run.speed * 2);
    step(run, 3);
    expect(run.over).toBe("caught");
  });

  it("stumbles far apart are fine", () => {
    const run = emptyRun();
    put(run, "crate", 1, 3);
    put(run, "crate", 1, 3 + run.speed * (CONFIG.stumbleWindow + 1.5));
    step(run, CONFIG.stumbleWindow + 3);
    expect(run.stats.stumbles).toBe(2);
    expect(run.over).toBeNull();
  });

  it("running head-on into a pod ends the run", () => {
    const run = emptyRun();
    put(run, "pod", 1, 4);
    step(run, 1);
    expect(run.over).toBe("crash");
  });

  it("moving sideways into a pod is a stumble that sends you back", () => {
    const run = emptyRun();
    put(run, "pod", 0, -2);
    step(run, 0.3, ["left"]);
    expect(run.over).toBeNull();
    expect(run.stats.stumbles).toBe(1);
    expect(run.player.lane).toBe(1);
  });

  it("freighters come toward you and meet you where the chunk says", () => {
    const run = emptyRun();
    const chunk = CHUNKS.find((c) => c.id === "freighter")!;
    const start = 60;
    // Run straight down lane 0, which is safe in this chunk.
    run.player.lane = run.player.prevLane = 0;
    run.player.fromX = laneX(0);
    placeChunk(run, chunk, start, seeded(9));
    const f = run.obstacles.find((o) => o.kind === "freighter");
    expect(f).toBeDefined();
    let metAt = NaN;
    while (run.distance < start + chunk.length) {
      stepRun(run, DT, rng);
      if (Number.isNaN(metAt) && f!.z <= run.distance) metAt = run.distance;
    }
    expect(f!.awake).toBe(true);
    expect(Math.abs(metAt - (start + chunk.rows[0].at))).toBeLessThan(1.5);
    expect(run.over).toBeNull();
  });
});

describe("power-ups", () => {
  it("Bubble Shield takes one crash for you", () => {
    const run = emptyRun();
    run.active.shield = 10;
    put(run, "pod", 1, 3);
    step(run, 1.5);
    expect(run.over).toBeNull();
    expect(run.active.shield).toBe(0);
  });

  it("Warp Dash smashes through anything and goes faster", () => {
    const run = emptyRun();
    run.active.warp = 3;
    const pod = put(run, "pod", 1, 3);
    put(run, "crate", 1, 15);
    step(run, 1.5);
    expect(run.over).toBeNull();
    expect(pod.smashed).toBe(true);
    expect(run.stats.stumbles).toBe(0);
    expect(run.speed).toBeGreaterThan(speedAt(run.elapsed));
  });

  it("Moon Boots jump high enough to bounce over a pod", () => {
    const run = emptyRun();
    run.active.boots = 8;
    put(run, "pod", 1, run.speed * 0.45);
    step(run, 0.02, ["up"]);
    step(run, 2);
    expect(run.over).toBeNull();
    expect(run.stats.stumbles).toBe(0);
  });

  it("Twin Stars doubles the score", () => {
    const run = emptyRun();
    run.active.twin = 5;
    expect(multiplier(run)).toBe(2);
    const a = emptyRun();
    step(run, 1);
    step(a, 1);
    expect(run.score).toBeCloseTo(a.score * 2, 0);
  });

  it("Star Magnet pulls in stardust from other lanes", () => {
    const run = emptyRun();
    run.dust.push({ id: 999, lane: 2, z: 5, y: 0.9, taken: false });
    const plain = emptyRun();
    plain.dust.push({ id: 999, lane: 2, z: 5, y: 0.9, taken: false });
    run.active.magnet = 5;
    step(run, 1);
    step(plain, 1);
    expect(run.stardust).toBe(1);
    expect(plain.stardust).toBe(0);
  });

  it("time out and say so", () => {
    const run = emptyRun();
    run.active.twin = 0.1;
    step(run, 0.2);
    expect(run.active.twin).toBe(0);
  });
});

describe("track", () => {
  it("starts with a breather each time a new sector begins", () => {
    const run = newRun();
    const r = seeded(3);
    const breathers: number[] = [];
    let last = "";
    while (run.distance < SECTORS[2].at + 100 && !run.over) {
      run.grace = 1; // never bump: we only care about the track here
      stepRun(run, DT, r);
      if (run.lastChunkId === "breather" && last !== "breather")
        breathers.push(run.nextChunkAt);
      last = run.lastChunkId;
    }
    expect(breathers.length).toBe(2);
  });

  it("spaces power-ups out", () => {
    const run = newRun();
    const r = seeded(5);
    const seen = new Map<number, number>();
    while (run.distance < 3000) {
      run.grace = 1;
      run.active.shield = 0;
      stepRun(run, DT, r);
      for (const u of run.pickups) seen.set(u.id, u.z);
    }
    const zs = [...seen.values()].sort((a, b) => a - b);
    expect(zs.length).toBeGreaterThan(3);
    for (let i = 1; i < zs.length; i++)
      expect(zs[i] - zs[i - 1]).toBeGreaterThanOrEqual(CONFIG.powerUpSpacing);
  });
});

/**
 * Whole runs played by a simple autopilot (autopilot.ts) that reacts a beat
 * late and wobbles its timing. The curve should suit a decent kid.
 */
describe("difficulty curve, played by an autopilot", () => {
  const MAX = 300;
  const runs: RunReport[] = [];
  for (let seed = 1; seed <= 60; seed++) runs.push(autopilot(seed, MAX));

  it("lets nearly everyone through the first sector", () => {
    const reached = runs.filter((r) => r.distance >= SECTORS[1].at).length;
    expect(reached / runs.length).toBeGreaterThanOrEqual(0.9);
  });

  it("has typical runs of about a minute, and long runs are possible", () => {
    const seconds = runs.map((r) => r.seconds).sort((a, b) => a - b);
    const median = seconds[Math.floor(seconds.length / 2)];
    expect(median).toBeGreaterThan(40);
    expect(median).toBeLessThan(150);
    expect(
      runs.filter((r) => r.sector >= SECTORS.length - 2).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("gets harder sector by sector", () => {
    /** Run-ending bumps per kilometre run in sectors `from`..`to`. */
    const rate = (from: number, to: number) => {
      const start = SECTORS[from].at;
      const end = SECTORS[to + 1]?.at ?? Infinity;
      const km =
        runs.reduce(
          (sum, r) => sum + Math.max(0, Math.min(r.distance, end) - start),
          0,
        ) / 1000;
      const ends = runs.filter(
        (r) => !r.survived && r.sector >= from && r.sector <= to,
      ).length;
      return ends / km;
    };
    const early = rate(0, 2);
    const middle = rate(3, 4);
    const late = rate(5, 5);
    expect(middle).toBeGreaterThan(early * 3);
    expect(late).toBeGreaterThan(middle);
  });
});
