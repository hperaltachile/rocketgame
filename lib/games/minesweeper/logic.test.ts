import { describe, expect, it } from "vitest";
import { seeded } from "../rng";
import {
  flagsPlaced,
  neighbors,
  newBoard,
  reveal,
  toggleFlag,
  withMines,
  type Board,
} from "./logic";

/** Draws a board: "*" mine, "." hidden, " " revealed empty, digits revealed numbers, "F" flag. */
function picture(board: Board): string[] {
  const rows: string[] = [];
  for (let r = 0; r < board.rows; r++) {
    let line = "";
    for (let c = 0; c < board.cols; c++) {
      const cell = board.cells[r * board.cols + c];
      if (cell.flagged) line += "F";
      else if (!cell.revealed) line += ".";
      else if (cell.mine) line += "*";
      else line += cell.adjacent === 0 ? " " : String(cell.adjacent);
    }
    rows.push(line);
  }
  return rows;
}

describe("first click safety", () => {
  it("never loses on the first click, and always opens an area (200 random games)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seeded(seed);
      const first = Math.floor(rng() * 81);
      const board = reveal(newBoard(), first, rng);
      expect(board.state).not.toBe("lost");
      expect(board.cells[first].mine).toBe(false);
      expect(board.cells[first].adjacent).toBe(0);
      for (const n of neighbors(board, first))
        expect(board.cells[n].mine).toBe(false);
      expect(board.cells.filter((c) => c.mine)).toHaveLength(10);
    }
  });

  it("places exactly the requested number of mines", () => {
    const board = reveal(newBoard(9, 9, 10), 40, seeded(7));
    expect(board.cells.filter((c) => c.mine)).toHaveLength(10);
  });
});

describe("flood fill", () => {
  // 5×5 board with mines in the right column's top two cells.
  const base = () => withMines(newBoard(5, 5, 2), [4, 9]);

  it("opens every connected empty cell and its numbered border", () => {
    const board = reveal(base(), 20); // bottom-left corner
    // Everything safe is open, so it is a win and the two mines get flagged.
    expect(picture(board)).toEqual([
      "   2F",
      "   2F",
      "   11",
      "     ",
      "     ",
    ]);
    expect(board.state).toBe("won");
  });

  it("revealing a numbered cell opens only that cell", () => {
    const board = reveal(base(), 3);
    expect(board.cells.filter((c) => c.revealed)).toHaveLength(1);
    expect(board.cells[3].adjacent).toBe(2);
  });

  it("does not open flagged cells", () => {
    const flagged = toggleFlag(base(), 0);
    const board = reveal(flagged, 20);
    expect(board.cells[0].revealed).toBe(false);
    expect(board.cells[0].flagged).toBe(true);
    expect(board.state).toBe("playing");
  });
});

describe("winning and losing", () => {
  it("loses when a mine is revealed and shows all mines", () => {
    const board = reveal(withMines(newBoard(3, 3, 2), [0, 8]), 8);
    expect(board.state).toBe("lost");
    expect(board.exploded).toBe(8);
    expect(board.cells[0].revealed).toBe(true);
  });

  it("wins when every safe cell is open, and flags the mines", () => {
    let board = withMines(newBoard(2, 2, 1), [0]);
    board = reveal(board, 1);
    board = reveal(board, 2);
    expect(board.state).toBe("playing");
    board = reveal(board, 3);
    expect(board.state).toBe("won");
    expect(board.cells[0].flagged).toBe(true);
  });

  it("ignores clicks after the game ends", () => {
    const lost = reveal(withMines(newBoard(3, 3, 1), [4]), 4);
    expect(reveal(lost, 0)).toBe(lost);
    expect(toggleFlag(lost, 0)).toBe(lost);
  });
});

describe("flags", () => {
  it("toggles on hidden cells only and counts them", () => {
    let board = withMines(newBoard(3, 3, 1), [8]);
    board = toggleFlag(board, 0);
    expect(flagsPlaced(board)).toBe(1);
    board = toggleFlag(board, 0);
    expect(flagsPlaced(board)).toBe(0);
    board = reveal(board, 0);
    expect(toggleFlag(board, 0)).toBe(board);
  });
});
