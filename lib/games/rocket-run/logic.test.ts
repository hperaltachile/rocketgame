import { describe, expect, it } from "vitest";
import { seeded } from "../rng";
import { autopilot, type FlightReport } from "./autopilot";
import {
  AFTER_WALL,
  BREATHER,
  collides,
  DIFFICULTY,
  difficulty,
  FLIGHT,
  MIN_GAP,
  newRun,
  obstacleY,
  PX_PER_POINT,
  ROCKET,
  scoreFor,
  sectorAt,
  SECTORS,
  spawnAsteroid,
  spawnWave,
  stepRocket,
  stepRun,
  WALL_GAP,
  WORLD,
  type Obstacle,
} from "./logic";

const DT = 1 / 60;
const H = WORLD.height;

describe("scoreFor", () => {
  it("gives one point per PX_PER_POINT flown, rounded down", () => {
    expect(scoreFor(0)).toBe(0);
    expect(scoreFor(PX_PER_POINT - 1)).toBe(0);
    expect(scoreFor(PX_PER_POINT)).toBe(1);
    expect(scoreFor(PX_PER_POINT * 40 + 3)).toBe(40);
    expect(scoreFor(-100)).toBe(0);
  });
});

describe("difficulty curve", () => {
  it("starts gentle", () => {
    expect(difficulty(0)).toEqual({
      speed: DIFFICULTY.startSpeed,
      spawnEvery: DIFFICULTY.startSpawnEvery,
    });
  });

  it("never gets easier over time", () => {
    let prev = difficulty(0);
    for (let t = 0.5; t <= 300; t += 0.5) {
      const next = difficulty(t);
      expect(next.speed).toBeGreaterThanOrEqual(prev.speed);
      expect(next.spawnEvery).toBeLessThanOrEqual(prev.spawnEvery);
      prev = next;
    }
  });

  it("ramps up noticeably in the first 30 seconds", () => {
    expect(difficulty(30).speed).toBeGreaterThan(DIFFICULTY.startSpeed * 1.5);
    expect(difficulty(30).spawnEvery).toBeLessThan(
      DIFFICULTY.startSpawnEvery * 0.8,
    );
  });

  it("changes smoothly: no sudden jumps from one second to the next", () => {
    for (let t = 0; t < 300; t += 1) {
      expect(difficulty(t + 1).speed - difficulty(t).speed).toBeLessThan(8);
      expect(
        difficulty(t).spawnEvery - difficulty(t + 1).spawnEvery,
      ).toBeLessThan(0.02);
    }
  });

  it("is capped so it stays playable", () => {
    expect(difficulty(10_000)).toEqual({
      speed: DIFFICULTY.maxSpeed,
      spawnEvery: DIFFICULTY.minSpawnEvery,
    });
    // Waves always leave a good stretch of space between them.
    expect(DIFFICULTY.maxSpeed * DIFFICULTY.minSpawnEvery).toBeGreaterThan(300);
  });
});

describe("sectors", () => {
  it("start at 0 and come in order", () => {
    expect(SECTORS[0].at).toBe(0);
    for (let i = 1; i < SECTORS.length; i++) {
      expect(SECTORS[i].at).toBeGreaterThan(SECTORS[i - 1].at);
    }
  });

  it("each add a new kind of obstacle", () => {
    const seen = new Set<string>();
    for (const sector of SECTORS.slice(0, -1)) {
      const kinds = Object.keys(sector.mix);
      expect(kinds.some((kind) => !seen.has(kind))).toBe(true);
      kinds.forEach((kind) => seen.add(kind));
    }
  });

  it("sectorAt finds the sector for a time", () => {
    expect(sectorAt(0)).toBe(0);
    expect(sectorAt(SECTORS[1].at - 0.01)).toBe(0);
    expect(sectorAt(SECTORS[1].at)).toBe(1);
    expect(sectorAt(10_000)).toBe(SECTORS.length - 1);
  });
});

/** The biggest open vertical stretch a wave leaves at its spawn line. */
function widestGap(obstacles: Obstacle[], age = 0): number {
  const spans = obstacles
    .filter((o) => o.dx === 0)
    .map((o) => [obstacleY(o, age) - o.radius, obstacleY(o, age) + o.radius])
    .sort((a, b) => a[0] - b[0]);
  let widest = 0;
  let from = 0;
  for (const [lo, hi] of spans) {
    widest = Math.max(widest, lo - from);
    from = Math.max(from, hi);
  }
  return Math.max(widest, H - from);
}

describe("spawnWave", () => {
  it("always leaves a gap the rocket fits through easily", () => {
    for (let sector = 0; sector < SECTORS.length; sector++) {
      const rng = seeded(sector + 1);
      for (let i = 0; i < 400; i++) {
        const elapsed = SECTORS[sector].at + i;
        const { obstacles } = spawnWave(sector, elapsed, 400, rng);
        for (const age of [0, 0.5, 1, 1.5]) {
          expect(widestGap(obstacles, age)).toBeGreaterThanOrEqual(MIN_GAP);
        }
      }
    }
  });

  it("only uses the patterns the sector allows", () => {
    const rng = seeded(7);
    for (let sector = 0; sector < SECTORS.length; sector++) {
      for (let i = 0; i < 200; i++) {
        const { pattern } = spawnWave(sector, SECTORS[sector].at, 300, rng);
        expect(SECTORS[sector].mix[pattern]).toBeGreaterThan(0);
      }
    }
  });

  it("keeps wobbling rocks on screen", () => {
    const rng = seeded(3);
    for (let i = 0; i < 300; i++) {
      for (const o of spawnWave(1, 30, 300, rng).obstacles) {
        for (let age = 0; age < 6; age += 0.1) {
          expect(obstacleY(o, age) - o.radius).toBeGreaterThanOrEqual(-0.01);
          expect(obstacleY(o, age) + o.radius).toBeLessThanOrEqual(H + 0.01);
        }
      }
    }
  });

  it("walls start roomy and narrow down to a fair minimum", () => {
    const wallsFrom = SECTORS.find((s) => s.mix.wall)!.at;
    const gapOf = (elapsed: number) => {
      const rng = seeded(11);
      for (;;) {
        const wave = spawnWave(4, elapsed, 400, rng);
        if (wave.pattern === "wall") return widestGap(wave.obstacles);
      }
    };
    expect(gapOf(wallsFrom)).toBeGreaterThanOrEqual(WALL_GAP.first);
    expect(gapOf(wallsFrom + 1000)).toBeGreaterThanOrEqual(WALL_GAP.min);
    expect(gapOf(wallsFrom + 1000)).toBeLessThan(WALL_GAP.first);
  });

  it("sends comets from further away, so there's time to see the warning", () => {
    const rng = seeded(5);
    for (let i = 0; i < 200; i++) {
      for (const o of spawnWave(3, 70, 400, rng).obstacles) {
        if (o.kind === "comet") expect(o.dx).toBeGreaterThan(400);
      }
    }
  });
});

describe("stepRun", () => {
  it("gives a breather when a new sector starts", () => {
    const run = newRun();
    run.elapsed = SECTORS[1].at - DT / 2;
    run.spawnTimer = 0.1;
    const { newSector } = stepRun(run, DT, true, seeded(1));
    expect(newSector).toBe(true);
    expect(run.sector).toBe(1);
    expect(run.spawnTimer).toBeGreaterThan(BREATHER - 0.1);
  });

  it("waits longer after a wall", () => {
    const run = newRun();
    run.elapsed = 200;
    run.sector = SECTORS.length - 1;
    const rng = seeded(2);
    for (let i = 0; i < 2000; i++) {
      run.spawnTimer = 0;
      const { spawned } = stepRun(run, DT, true, rng);
      if (spawned[0]?.pattern === "wall") {
        expect(run.spawnTimer).toBeGreaterThanOrEqual(AFTER_WALL - DT);
        return;
      }
    }
    throw new Error("no wall spawned");
  });

  it("crashes when the rocket meets a rock", () => {
    const run = newRun();
    run.spawnTimer = 99;
    run.obstacles.push({
      ...spawnAsteroid(() => 0.5),
      id: 1,
      pattern: "rock",
      x: ROCKET.x + 5,
      y: run.flight.y,
      age: 0,
    });
    expect(stepRun(run, DT, true, seeded(1)).crashed?.id).toBe(1);
  });
});

describe("stepRocket", () => {
  it("falls under gravity", () => {
    const next = stepRocket({ y: 200, vy: 0 }, DT, false);
    expect(next.vy).toBeGreaterThan(0);
    expect(next.y).toBeGreaterThan(200);
  });

  it("a boost sends the rocket up", () => {
    const next = stepRocket({ y: 200, vy: 300 }, DT, true);
    expect(next.vy).toBeLessThan(0);
    expect(next.y).toBeLessThan(200);
  });

  it("caps the fall speed", () => {
    let flight = { y: 20, vy: 0 };
    for (let i = 0; i < 30; i++) flight = stepRocket(flight, DT, false);
    expect(flight.vy).toBeLessThanOrEqual(FLIGHT.maxFallSpeed);
  });

  it("stays inside the screen", () => {
    let up = { y: 100, vy: 0 };
    for (let i = 0; i < 120; i++) up = stepRocket(up, DT, i % 5 === 0);
    expect(up.y).toBeGreaterThanOrEqual(ROCKET.radius);

    let down = { y: 100, vy: 0 };
    for (let i = 0; i < 300; i++) down = stepRocket(down, DT, false);
    expect(down.y).toBe(WORLD.height - ROCKET.radius);
    expect(down.vy).toBe(0);
  });
});

describe("collides", () => {
  const rocket = { x: 150, y: 200, radius: 13 };

  it("detects overlapping circles", () => {
    expect(collides(rocket, { x: 170, y: 200, radius: 20 })).toBe(true);
  });

  it("ignores asteroids that are clearly apart", () => {
    expect(collides(rocket, { x: 250, y: 200, radius: 20 })).toBe(false);
  });

  it("forgives a graze", () => {
    // Touching edges exactly (distance = sum of radii) is not a hit.
    expect(collides(rocket, { x: 150 + 33, y: 200, radius: 20 })).toBe(false);
    expect(collides(rocket, { x: 150 + 33, y: 200, radius: 20 }, 1.01)).toBe(
      true,
    );
  });
});

describe("spawnAsteroid", () => {
  it("always spawns fully on screen with sane values", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.9999]) {
      const a = spawnAsteroid(() => r);
      expect(a.y - a.radius).toBeGreaterThanOrEqual(0);
      expect(a.y + a.radius).toBeLessThanOrEqual(WORLD.height);
      expect(a.speedFactor).toBeGreaterThan(0.8);
    }
  });
});

/**
 * Whole runs flown by a simple autopilot (lib/games/rocket-run/autopilot.ts)
 * that taps no faster than a quick kid. It's not a perfect player, which is
 * the point: the curve should suit someone decent, not a robot.
 */
describe("difficulty curve, played by an autopilot", () => {
  const MAX = 240;
  const runs: FlightReport[] = [];
  for (let seed = 1; seed <= 60; seed++) runs.push(autopilot(seed, MAX));

  /** Crashes per minute of flying in each sector. */
  const crashRate = SECTORS.map((sector, i) => {
    const end = SECTORS[i + 1]?.at ?? MAX;
    const minutes =
      runs.reduce(
        (sum, r) => sum + Math.max(0, Math.min(r.seconds, end) - sector.at),
        0,
      ) / 60;
    const crashes = runs.filter((r) => !r.survived && r.sector === i).length;
    return crashes / minutes;
  });

  it("lets nearly everyone through the first sector", () => {
    const reached = runs.filter((r) => r.seconds >= SECTORS[1].at).length;
    expect(reached / runs.length).toBeGreaterThanOrEqual(0.9);
  });

  it("gets harder sector by sector", () => {
    for (let i = 1; i < crashRate.length; i++) {
      expect(crashRate[i]).toBeGreaterThan(crashRate[i - 1]);
    }
    expect(crashRate.at(-1)!).toBeGreaterThan(crashRate[0] * 5);
  });

  it("has typical runs of about a minute, and long runs are possible", () => {
    const seconds = runs.map((r) => r.seconds).sort((a, b) => a - b);
    const median = seconds[Math.floor(seconds.length / 2)];
    expect(median).toBeGreaterThan(40);
    expect(median).toBeLessThan(120);
    const reached = (i: number) =>
      runs.filter((r) => r.seconds >= SECTORS[i].at).length;
    expect(reached(SECTORS.length - 2) / runs.length).toBeGreaterThanOrEqual(
      0.15,
    );
    expect(reached(SECTORS.length - 1)).toBeGreaterThanOrEqual(1);
  });
});
