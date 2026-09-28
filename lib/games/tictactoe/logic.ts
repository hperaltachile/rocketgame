/** Pure Tic-Tac-Toe rules and the computer player. The player is X, the computer O. */

import type { Rng } from "../rng";

export type Mark = "X" | "O";
export type Board = (Mark | null)[];
export type Difficulty = "easy" | "hard";

export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export const emptyBoard = (): Board => Array<Mark | null>(9).fill(null);

export function winner(
  board: Board,
): { mark: Mark; line: readonly number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) return { mark, line };
  }
  return null;
}

export function emptyCells(board: Board): number[] {
  return board.flatMap((cell, i) => (cell === null ? [i] : []));
}

export const isDraw = (board: Board) =>
  !winner(board) && emptyCells(board).length === 0;

export function place(board: Board, index: number, mark: Mark): Board {
  if (board[index] !== null) return board;
  const next = [...board];
  next[index] = mark;
  return next;
}

const other = (mark: Mark): Mark => (mark === "X" ? "O" : "X");

/** Score from `me`'s point of view: faster wins and slower losses score better. */
function minimax(
  board: Board,
  toMove: Mark,
  me: Mark,
  depth: number,
  alpha: number,
  beta: number,
): number {
  const win = winner(board);
  if (win) return win.mark === me ? 10 - depth : depth - 10;
  const moves = emptyCells(board);
  if (moves.length === 0) return 0;

  if (toMove === me) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(
        best,
        minimax(
          place(board, m, toMove),
          other(toMove),
          me,
          depth + 1,
          alpha,
          beta,
        ),
      );
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    best = Math.min(
      best,
      minimax(
        place(board, m, toMove),
        other(toMove),
        me,
        depth + 1,
        alpha,
        beta,
      ),
    );
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

/** Perfect play: returns the best cell for `me`, or -1 if the board is full. */
export function bestMove(board: Board, me: Mark = "O"): number {
  let best = -1;
  let bestScore = -Infinity;
  for (const m of emptyCells(board)) {
    const score = minimax(
      place(board, m, me),
      other(me),
      me,
      1,
      -Infinity,
      Infinity,
    );
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export function randomMove(board: Board, rng: Rng = Math.random): number {
  const moves = emptyCells(board);
  return moves.length ? moves[Math.floor(rng() * moves.length)] : -1;
}

export function computerMove(
  board: Board,
  difficulty: Difficulty,
  rng: Rng = Math.random,
): number {
  return difficulty === "hard" ? bestMove(board, "O") : randomMove(board, rng);
}

export type Tally = { wins: number; draws: number; losses: number };
export const emptyTally = (): Tally => ({ wins: 0, draws: 0, losses: 0 });
