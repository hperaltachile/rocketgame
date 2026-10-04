import { describe, expect, it } from "vitest";
import { seeded } from "../rng";
import {
  applyResult,
  BASE_TRAVEL,
  isGameOver,
  judgeSwing,
  newCount,
  nextPitch,
  pitchMix,
  speedUp,
  type Count,
} from "./logic";

describe("swing timing", () => {
  it("perfect timing is a home run, good is a hit", () => {
    expect(judgeSwing(0)).toBe("homeRun");
    expect(judgeSwing(-30)).toBe("homeRun");
    expect(judgeSwing(60)).toBe("hit");
    expect(judgeSwing(-90)).toBe("hit");
  });

  it("a bit early or late is a foul, way off is a strike", () => {
    expect(judgeSwing(-140)).toBe("foul");
    expect(judgeSwing(150)).toBe("foul");
    expect(judgeSwing(-400)).toBe("strike");
    expect(judgeSwing(300)).toBe("strike");
  });

  it("not swinging is a strike", () => {
    expect(judgeSwing(null)).toBe("strike");
  });
});

describe("pitches", () => {
  it("mixes slow, medium and fast", () => {
    const rng = seeded(1);
    const seen = new Set(
      Array.from({ length: 200 }, () => nextPitch(0, rng).speed),
    );
    expect(seen).toEqual(new Set(["slow", "medium", "fast"]));
  });

  it("more fast pitches as the score goes up", () => {
    expect(pitchMix(20).fast).toBeGreaterThan(pitchMix(0).fast);
    expect(pitchMix(20).slow).toBeLessThan(pitchMix(0).slow);
    const mix = pitchMix(7);
    expect(mix.slow + mix.medium + mix.fast).toBeCloseTo(1);
  });

  it("pitches speed up with the score, up to a limit", () => {
    expect(nextPitch(0, () => 0).travelMs).toBe(BASE_TRAVEL.slow);
    expect(nextPitch(10, () => 0).travelMs).toBeLessThan(BASE_TRAVEL.slow);
    expect(speedUp(1000)).toBe(0.25);
    expect(nextPitch(1000, () => 0.99).travelMs).toBe(
      Math.round(BASE_TRAVEL.fast * 0.75),
    );
  });
});

describe("count", () => {
  const play = (
    results: Parameters<typeof applyResult>[1][],
    from: Count = newCount(),
  ) => results.reduce(applyResult, from);

  it("hits and home runs score and reset the strikes", () => {
    const count = play(["strike", "hit", "strike", "strike", "homeRun"]);
    expect(count).toEqual({
      strikes: 0,
      outs: 0,
      hits: 1,
      homeRuns: 1,
      score: 5,
    });
  });

  it("three strikes make an out", () => {
    const count = play(["strike", "strike", "strike"]);
    expect(count.outs).toBe(1);
    expect(count.strikes).toBe(0);
  });

  it("a foul can't be strike three", () => {
    const count = play(["strike", "strike", "foul", "foul"]);
    expect(count.strikes).toBe(2);
    expect(count.outs).toBe(0);
    expect(play(["foul"]).strikes).toBe(1);
  });

  it("three outs end the game", () => {
    const count = play(Array(9).fill("strike"));
    expect(count.outs).toBe(3);
    expect(isGameOver(count)).toBe(true);
    expect(applyResult(count, "homeRun")).toBe(count);
  });
});
