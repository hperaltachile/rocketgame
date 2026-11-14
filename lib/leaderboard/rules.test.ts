import { describe, expect, it } from "vitest";
import { GAMES } from "@/lib/games/registry";
import {
  BOARD_SIZE,
  hasLeaderboard,
  LEADERBOARD,
  qualifies,
  rankOf,
  validateSubmission,
  type Entry,
} from "./rules";

const ID = "3f2b8c1e-9d4a-4b6f-8e2a-1c5d7f9b0a12";
const ok = { slug: "snake", name: "Cosmic Fox 42", score: 25, playerId: ID };

const board = (...scores: number[]): Entry[] =>
  scores.map((score, i) => ({ name: `Cosmic Fox ${i + 1}`, score }));

describe("which games have a board", () => {
  it("every game but Tic-Tac-Toe", () => {
    for (const game of GAMES) {
      expect(hasLeaderboard(game.slug)).toBe(game.slug !== "tictactoe");
    }
    expect(hasLeaderboard("nope")).toBe(false);
  });

  it("caps make sense", () => {
    for (const rule of Object.values(LEADERBOARD)) {
      expect(rule.min).toBeGreaterThan(0);
      expect(rule.max).toBeGreaterThan(rule.min);
    }
  });
});

describe("validateSubmission", () => {
  it("accepts a good one and normalises the player id", () => {
    const result = validateSubmission({ ...ok, playerId: ID.toUpperCase() });
    expect(result).toMatchObject({ ok: true, score: 25, playerId: ID });
  });

  it("rejects unknown games and Tic-Tac-Toe", () => {
    expect(validateSubmission({ ...ok, slug: "nope" })).toEqual({
      ok: false,
      reason: "game",
    });
    expect(validateSubmission({ ...ok, slug: "tictactoe", score: 3 })).toEqual({
      ok: false,
      reason: "game",
    });
  });

  it("rejects typed names", () => {
    expect(validateSubmission({ ...ok, name: "Sam from 4B" })).toMatchObject({
      reason: "name",
    });
  });

  it("rejects scores outside the game's range", () => {
    for (const score of [0, -5, 2.5, 18 * 18 + 1, NaN, Infinity, "25", null]) {
      expect(validateSubmission({ ...ok, score })).toMatchObject({
        reason: "score",
      });
    }
    expect(
      validateSubmission({ ...ok, slug: "nova-shootout", score: 6 }),
    ).toMatchObject({ reason: "score" });
    expect(
      validateSubmission({ ...ok, slug: "memory", score: 7 }),
    ).toMatchObject({ reason: "score" });
    expect(validateSubmission({ ...ok, slug: "memory", score: 8 }).ok).toBe(
      true,
    );
  });

  it("rejects bad player ids", () => {
    for (const playerId of ["", "abc", 12, null, `${ID}x`]) {
      expect(validateSubmission({ ...ok, playerId })).toMatchObject({
        reason: "player",
      });
    }
  });
});

describe("qualifies", () => {
  const full = board(100, 90, 80, 70, 60, 50, 40, 30, 20, 10);

  it("anything makes a board that isn't full", () => {
    expect(full).toHaveLength(BOARD_SIZE);
    expect(qualifies(board(50), 1, "high")).toBe(true);
    expect(qualifies([], 999, "low")).toBe(true);
  });

  it("a full board needs a score that beats the last row", () => {
    expect(qualifies(full, 11, "high")).toBe(true);
    expect(qualifies(full, 10, "high")).toBe(false);
    const fastest = board(5, 6, 7, 8, 9, 10, 11, 12, 13, 14);
    expect(qualifies(fastest, 13, "low")).toBe(true);
    expect(qualifies(fastest, 14, "low")).toBe(false);
  });

  it("a player must beat their own saved score", () => {
    expect(qualifies(board(50), 40, "high", { score: 45, onBoard: true })).toBe(
      false,
    );
    expect(qualifies(full, 11, "high", { score: 10, onBoard: true })).toBe(
      true,
    );
    expect(qualifies(full, 15, "high", { score: 5, onBoard: false })).toBe(
      true,
    );
    expect(qualifies(full, 8, "high", { score: 5, onBoard: false })).toBe(
      false,
    );
  });
});

describe("rankOf", () => {
  it("places a score after everything it doesn't beat", () => {
    expect(rankOf([], 5, "high")).toBe(1);
    expect(rankOf(board(100, 50, 10), 60, "high")).toBe(2);
    expect(rankOf(board(100, 50, 10), 50, "high")).toBe(3);
    expect(rankOf(board(5, 9, 12), 9, "low")).toBe(3);
    expect(rankOf(board(5, 9, 12), 4, "low")).toBe(1);
  });
});
