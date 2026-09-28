import { describe, expect, it } from "vitest";
import {
  collides,
  DIFFICULTY,
  difficulty,
  FLIGHT,
  PX_PER_POINT,
  ROCKET,
  scoreFor,
  spawnAsteroid,
  stepRocket,
  WORLD,
} from "./logic";

const DT = 1 / 60;

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
    for (let t = 0.5; t <= 180; t += 0.5) {
      const next = difficulty(t);
      expect(next.speed).toBeGreaterThanOrEqual(prev.speed);
      expect(next.spawnEvery).toBeLessThanOrEqual(prev.spawnEvery);
      prev = next;
    }
  });

  it("ramps up noticeably in the first 30 seconds", () => {
    expect(difficulty(30).speed).toBeGreaterThan(DIFFICULTY.startSpeed * 1.5);
    expect(difficulty(30).spawnEvery).toBeLessThan(DIFFICULTY.startSpawnEvery);
  });

  it("is capped so it stays playable", () => {
    expect(difficulty(10_000)).toEqual({
      speed: DIFFICULTY.maxSpeed,
      spawnEvery: DIFFICULTY.minSpawnEvery,
    });
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
