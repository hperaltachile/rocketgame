/** Pure Minesweeper rules. Cells are indexed row-major: index = row * cols + col. */

import type { Rng } from "../rng";

export type Cell = {
  mine: boolean;
  /** Mines in the 8 neighbouring cells. */
  adjacent: number;
  revealed: boolean;
  flagged: boolean;
};

export type Board = {
  rows: number;
  cols: number;
  mines: number;
  cells: Cell[];
  /** Mines are placed on the first reveal, so the first click is always safe. */
  minesPlaced: boolean;
  state: "playing" | "won" | "lost";
  /** The mine that was stepped on, if lost. */
  exploded: number | null;
};

export function newBoard(rows = 9, cols = 9, mines = 10): Board {
  return {
    rows,
    cols,
    mines,
    cells: Array.from({ length: rows * cols }, () => ({
      mine: false,
      adjacent: 0,
      revealed: false,
      flagged: false,
    })),
    minesPlaced: false,
    state: "playing",
    exploded: null,
  };
}

export function neighbors(
  board: Pick<Board, "rows" | "cols">,
  index: number,
): number[] {
  const row = Math.floor(index / board.cols);
  const col = index % board.cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < board.rows && c >= 0 && c < board.cols) {
        out.push(r * board.cols + c);
      }
    }
  }
  return out;
}

/** Board with mines at the given cells (for tests and for placeMines). */
export function withMines(board: Board, mineIndices: number[]): Board {
  const mines = new Set(mineIndices);
  const cells = board.cells.map((cell, i) => ({
    ...cell,
    mine: mines.has(i),
    adjacent: neighbors(board, i).filter((n) => mines.has(n)).length,
  }));
  return { ...board, cells, mines: mines.size, minesPlaced: true };
}

/**
 * Places mines anywhere except the first-clicked cell and, when there is
 * room, its neighbours — so the first click always opens an area.
 */
export function placeMines(board: Board, safe: number, rng: Rng): Board {
  const total = board.rows * board.cols;
  const aroundSafe = new Set([safe, ...neighbors(board, safe)]);
  const keepClear =
    total - aroundSafe.size >= board.mines ? aroundSafe : new Set([safe]);
  const candidates: number[] = [];
  for (let i = 0; i < total; i++) if (!keepClear.has(i)) candidates.push(i);
  const chosen: number[] = [];
  for (let k = 0; k < board.mines && candidates.length > 0; k++) {
    const pick = Math.floor(rng() * candidates.length);
    chosen.push(candidates[pick]);
    candidates.splice(pick, 1);
  }
  return withMines(board, chosen);
}

export function flagsPlaced(board: Board): number {
  return board.cells.filter((c) => c.flagged).length;
}

export function toggleFlag(board: Board, index: number): Board {
  const cell = board.cells[index];
  if (board.state !== "playing" || cell.revealed) return board;
  const cells = [...board.cells];
  cells[index] = { ...cell, flagged: !cell.flagged };
  return { ...board, cells };
}

/** Reveals a cell; empty cells (0 adjacent) flood-fill outward. */
export function reveal(
  board: Board,
  index: number,
  rng: Rng = Math.random,
): Board {
  if (board.state !== "playing") return board;
  const target = board.cells[index];
  if (target.revealed || target.flagged) return board;

  const placed = board.minesPlaced ? board : placeMines(board, index, rng);
  const cells = placed.cells.map((c) => ({ ...c }));

  if (cells[index].mine) {
    for (const cell of cells) if (cell.mine) cell.revealed = true;
    return { ...placed, cells, state: "lost", exploded: index };
  }

  const queue = [index];
  cells[index].revealed = true;
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (cells[current].adjacent !== 0) continue;
    for (const n of neighbors(placed, current)) {
      const cell = cells[n];
      if (!cell.revealed && !cell.flagged && !cell.mine) {
        cell.revealed = true;
        queue.push(n);
      }
    }
  }

  const safeCells = cells.length - placed.mines;
  const revealed = cells.filter((c) => c.revealed).length;
  if (revealed === safeCells) {
    for (const cell of cells) if (cell.mine) cell.flagged = true;
    return { ...placed, cells, state: "won" };
  }
  return { ...placed, cells };
}
