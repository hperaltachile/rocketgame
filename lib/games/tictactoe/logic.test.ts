import { describe, expect, it } from "vitest";
import {
  bestMove,
  computerMove,
  emptyBoard,
  emptyCells,
  isDraw,
  place,
  randomMove,
  winner,
  type Board,
} from "./logic";

const board = (s: string): Board =>
  s
    .replace(/\s/g, "")
    .split("")
    .map((ch) => (ch === "X" || ch === "O" ? ch : null));

describe("winner", () => {
  it.each([
    ["XXX ... ...", [0, 1, 2]],
    ["... OOO ...", [3, 4, 5]],
    ["... ... XXX", [6, 7, 8]],
    ["X.. X.. X..", [0, 3, 6]],
    [".O. .O. .O.", [1, 4, 7]],
    ["..X ..X ..X", [2, 5, 8]],
    ["X.. .X. ..X", [0, 4, 8]],
    ["..O .O. O..", [2, 4, 6]],
  ])("%s wins on %j", (s, line) => {
    expect(winner(board(s))?.line).toEqual(line);
  });

  it("returns null without three in a row", () => {
    expect(winner(board("XOX XOO OXX"))).toBeNull();
    expect(winner(emptyBoard())).toBeNull();
  });

  it("detects a draw only on a full board with no winner", () => {
    expect(isDraw(board("XOX XOO OXX"))).toBe(true);
    expect(isDraw(board("XOX XO. OXX"))).toBe(false);
    expect(isDraw(board("XXX OO. ..."))).toBe(false);
  });
});

describe("minimax (Hard)", () => {
  it("takes a winning move", () => {
    expect(bestMove(board("OO. XX. X.."), "O")).toBe(2);
  });

  it("blocks the player's winning move", () => {
    expect(bestMove(board("XX. .O. ..."), "O")).toBe(2);
  });

  it("prefers winning now over blocking", () => {
    expect(bestMove(board("XX. OO. X.."), "O")).toBe(5);
  });

  it("never loses, whatever the player does (every game tree)", () => {
    let games = 0;
    const explore = (b: Board) => {
      for (const m of emptyCells(b)) {
        const afterX = place(b, m, "X");
        expect(winner(afterX)?.mark).not.toBe("X");
        if (winner(afterX) || isDraw(afterX)) {
          games++;
          continue;
        }
        const afterO = place(afterX, bestMove(afterX, "O"), "O");
        if (winner(afterO) || isDraw(afterO)) {
          games++;
          continue;
        }
        explore(afterO);
      }
    };
    explore(emptyBoard());
    expect(games).toBeGreaterThan(100);
  });
});

describe("Easy", () => {
  it("always picks an empty cell", () => {
    const b = board("XOX .O. X..");
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const m = randomMove(b, () => r);
      expect(b[m]).toBeNull();
    }
    expect(computerMove(b, "easy", () => 0)).toBe(3);
  });

  it("returns -1 on a full board", () => {
    expect(randomMove(board("XOX XOO OXX"))).toBe(-1);
    expect(bestMove(board("XOX XOO OXX"))).toBe(-1);
  });
});
