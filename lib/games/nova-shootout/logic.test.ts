import { describe, expect, it } from "vitest";
import { seeded } from "../rng";
import {
  clampAim,
  goals,
  isRoundOver,
  keeperDive,
  KICKS,
  kicksTaken,
  newRound,
  powerAt,
  recordKick,
  resolveShot,
  shotLanding,
  zoneCenter,
  zoneOf,
} from "./logic";

/** An rng that returns the given values in order (then repeats the last). */
const sequence =
  (...values: number[]) =>
  () =>
    values.length > 1 ? values.shift()! : values[0];

describe("power bar", () => {
  it("sweeps up and back down", () => {
    expect(powerAt(0, 2)).toBe(0);
    expect(powerAt(0.5, 2)).toBeCloseTo(0.5);
    expect(powerAt(1, 2)).toBeCloseTo(1);
    expect(powerAt(1.5, 2)).toBeCloseTo(0.5);
    expect(powerAt(2, 2)).toBeCloseTo(0);
    expect(powerAt(3, 2)).toBeCloseTo(1);
  });
});

describe("aim", () => {
  it("stays inside the goal", () => {
    expect(clampAim({ x: -3, y: 2 })).toEqual({ x: -0.95, y: 0.95 });
    expect(clampAim({ x: 0.2, y: 0.3 })).toEqual({ x: 0.2, y: 0.3 });
  });

  it("maps to one of six zones", () => {
    expect(zoneOf({ x: -0.8, y: 0.9 })).toEqual({ col: -1, high: true });
    expect(zoneOf({ x: 0.1, y: 0.1 })).toEqual({ col: 0, high: false });
    expect(zoneOf({ x: 0.5, y: 0.2 })).toEqual({ col: 1, high: false });
  });
});

describe("goalie", () => {
  it("dives to the shot's zone when he reads it", () => {
    const aim = { x: 0.8, y: 0.8 };
    expect(keeperDive(aim, "hard", 0, sequence(0))).toEqual(
      zoneCenter(1, true),
    );
  });

  it("otherwise guesses a zone", () => {
    // 0.99 fails the read; 0.0 → left column; 0.9 → low.
    const dive = keeperDive(
      { x: 0.8, y: 0.8 },
      "easy",
      0,
      sequence(0.99, 0, 0.9),
    );
    expect(dive).toEqual(zoneCenter(-1, false));
  });

  it("reads more shots on harder levels and later kicks", () => {
    const aim = { x: -0.7, y: 0.3 };
    const target = zoneCenter(-1, false);
    const reads = (difficulty: "easy" | "hard", kick: number) => {
      const rng = seeded(7);
      let hits = 0;
      for (let i = 0; i < 4000; i++) {
        const d = keeperDive(aim, difficulty, kick, rng);
        if (d.x === target.x && d.y === target.y) hits++;
      }
      return hits;
    };
    expect(reads("hard", 0)).toBeGreaterThan(reads("easy", 0));
    expect(reads("easy", 4)).toBeGreaterThan(reads("easy", 0));
  });
});

describe("shots", () => {
  it("good power lands close to the aim", () => {
    const landing = shotLanding({ x: 0.5, y: 0.5 }, 0.6, seeded(1));
    expect(Math.abs(landing.x - 0.5)).toBeLessThan(0.04);
    expect(Math.abs(landing.y - 0.5)).toBeLessThan(0.04);
  });

  it("a corner shot past a goalie diving the other way is a goal", () => {
    const shot = { aim: { x: 0.85, y: 0.8 }, power: 0.65 };
    const { outcome } = resolveShot(
      shot,
      zoneCenter(-1, true),
      "hard",
      seeded(2),
    );
    expect(outcome).toBe("goal");
  });

  it("the goalie saves a shot right at him", () => {
    const shot = { aim: { x: 0.6, y: 0.25 }, power: 0.65 };
    const { outcome } = resolveShot(
      shot,
      zoneCenter(1, false),
      "easy",
      seeded(3),
    );
    expect(outcome).toBe("saved");
  });

  it("a weak shot is easier to save", () => {
    const aim = { x: 0, y: 0.6 };
    const dive = zoneCenter(0, false);
    const rng = () => 0.5; // no random error
    expect(resolveShot({ aim, power: 0.6 }, dive, "easy", rng).outcome).toBe(
      "goal",
    );
    expect(resolveShot({ aim, power: 0.05 }, dive, "easy", rng).outcome).toBe(
      "saved",
    );
  });

  it("full power sails over the bar", () => {
    const shot = { aim: { x: 0, y: 0.6 }, power: 1 };
    expect(
      resolveShot(shot, zoneCenter(1, true), "easy", () => 0.5).outcome,
    ).toBe("over");
  });

  it("hitting the post or going wide is a miss", () => {
    const rng = () => 0.5;
    const post = resolveShot(
      { aim: { x: 0.99, y: 0.5 }, power: 0.6 },
      zoneCenter(-1, false),
      "easy",
      rng,
    );
    expect(post.outcome).toBe("post");
    const wide = resolveShot(
      { aim: { x: 1.2, y: 0.5 }, power: 0.6 },
      zoneCenter(-1, false),
      "easy",
      rng,
    );
    expect(wide.outcome).toBe("wide");
  });
});

describe("round", () => {
  it("is five kicks and counts goals", () => {
    let round = newRound();
    for (const outcome of ["goal", "saved", "goal", "over", "goal"] as const) {
      expect(isRoundOver(round)).toBe(false);
      round = recordKick(round, outcome);
    }
    expect(kicksTaken(round)).toBe(KICKS);
    expect(goals(round)).toBe(3);
    expect(isRoundOver(round)).toBe(true);
    expect(recordKick(round, "goal")).toBe(round);
  });
});
