import { describe, expect, it } from "vitest";
import { canMove, fromGrid, move, newGame, slideLine, toGrid } from "./logic";

/** Always spawns into the first empty cell. */
const firstCell = () => 0;
/** Always spawns into the last empty cell (bottom-right), out of the way. */
const lastCell = () => 0.999;

describe("slideLine", () => {
  it.each([
    [[2, 2, 0, 0], [4, 0, 0, 0], 4],
    [[2, 0, 0, 2], [4, 0, 0, 0], 4],
    [[2, 2, 2, 2], [4, 4, 0, 0], 8],
    [[2, 2, 2, 0], [4, 2, 0, 0], 4],
    [[4, 4, 8, 0], [8, 8, 0, 0], 8],
    [[2, 4, 8, 16], [2, 4, 8, 16], 0],
    [[0, 0, 0, 0], [0, 0, 0, 0], 0],
    [[8, 0, 8, 4], [16, 4, 0, 0], 16],
  ])("%j -> %j (+%i)", (input, expected, gained) => {
    expect(slideLine(input)).toEqual({ line: expected, gained });
  });
});

describe("move", () => {
  it("merges toward the move direction and adds the merged value to the score", () => {
    const game = fromGrid([
      [2, 2, 4, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const next = move(game, "right", lastCell);
    expect(toGrid(next)[0]).toEqual([0, 0, 4, 8]);
    expect(next.score).toBe(12);
  });

  it("moves columns for up and down", () => {
    const game = fromGrid([
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [4, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const column = (g: typeof game) => toGrid(g).map((row) => row[0]);
    expect(column(move(game, "down", lastCell))).toEqual([0, 0, 4, 4]);
    expect(column(move(game, "up", lastCell))).toEqual([4, 4, 0, 0]);
  });

  it("does nothing (same object, no spawn) when no tile can move", () => {
    const game = fromGrid([
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(move(game, "left", firstCell)).toBe(game);
  });

  it("spawns exactly one tile after a successful move", () => {
    const game = fromGrid([
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const next = move(game, "left", () => 0.5);
    const values = toGrid(next)
      .flat()
      .filter((v) => v !== 0);
    expect(values).toHaveLength(2);
  });

  it("keeps merged-away tiles for one render, then drops them", () => {
    const game = fromGrid([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const once = move(game, "left", firstCell);
    expect(once.tiles.filter((t) => t.kind === "consumed")).toHaveLength(2);
    const twice = move(once, "down", firstCell);
    expect(twice.tiles.some((t) => t.kind === "consumed")).toBe(false);
  });

  it("flags a win when a 2048 tile is made", () => {
    const game = fromGrid([
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(game.won).toBe(false);
    expect(move(game, "left", firstCell).won).toBe(true);
  });

  it("ends the game when the board fills with no merges left", () => {
    const game = fromGrid([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [8, 16, 8, 0],
    ]);
    expect(game.over).toBe(false);
    // Slides the last row right; rng 0.95 spawns a 4 in the only empty cell.
    const next = move(game, "right", () => 0.95);
    expect(toGrid(next)[3]).toEqual([4, 8, 16, 8]);
    expect(next.over).toBe(true);
    expect(move(next, "left")).toBe(next);
  });
});

describe("newGame", () => {
  it("starts with two tiles and no score", () => {
    const game = newGame(() => 0.5);
    expect(game.tiles).toHaveLength(2);
    expect(game.score).toBe(0);
    expect(game.over).toBe(false);
  });
});

describe("canMove", () => {
  it("is false on a full board with no equal neighbours", () => {
    expect(
      canMove(
        fromGrid([
          [2, 4, 2, 4],
          [4, 2, 4, 2],
          [2, 4, 2, 4],
          [4, 2, 4, 2],
        ]),
      ),
    ).toBe(false);
  });

  it("is true on a full board with an equal neighbour", () => {
    expect(
      canMove(
        fromGrid([
          [2, 2, 4, 8],
          [4, 8, 16, 32],
          [8, 16, 32, 64],
          [16, 32, 64, 128],
        ]),
      ),
    ).toBe(true);
  });
});
