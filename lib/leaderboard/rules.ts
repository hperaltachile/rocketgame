import { getGame, type GameInfo, type GameSlug } from "@/lib/games/registry";
import { isValidName } from "./names";

/** How many rows each board shows and keeps ranked. */
export const BOARD_SIZE = 10;

type BoardRule = {
  /** Highest score accepted. Keep it in line with the game's scoring. */
  max: number;
  /** Lowest score accepted (low-is-better games: fewest moves, fastest time). */
  min: number;
};

/**
 * Games with a leaderboard, and the scores they can plausibly reach.
 * Tic-Tac-Toe has none: its "Wins" only grows with time played.
 */
export const LEADERBOARD: Readonly<Partial<Record<GameSlug, BoardRule>>> = {
  "astro-hop": { min: 1, max: 999_999 },
  // About 1,550 points per round won (seconds, win bonus) plus close calls.
  "hide-and-seek": { min: 1, max: 1_000_000 },
  "rocket-run": { min: 1, max: 1_000_000 },
  "star-courier": { min: 1, max: 10_000_000 },
  "nova-shootout": { min: 1, max: 5 },
  "cosmic-slam": { min: 1, max: 1_000_000 },
  // 18×18 grid, starting 3 long.
  snake: { min: 1, max: 18 * 18 },
  // Seconds; nobody clears 9×9 with 10 mines faster than this.
  minesweeper: { min: 3, max: 3_600 },
  // A move turns two cards; 8 pairs need at least 8 moves.
  memory: { min: 8, max: 1_000 },
  "2048": { min: 4, max: 4_000_000 },
};

export type Entry = { name: string; score: number };

export function boardGame(slug: string): GameInfo | null {
  const game = getGame(slug);
  return game && LEADERBOARD[game.slug] ? game : null;
}

export const hasLeaderboard = (slug: string) => boardGame(slug) !== null;

export type Submission = {
  slug: string;
  name: unknown;
  score: unknown;
  playerId: unknown;
};

export type Validation =
  | { ok: true; game: GameInfo; name: string; score: number; playerId: string }
  | { ok: false; reason: "game" | "name" | "score" | "player" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateSubmission({
  slug,
  name,
  score,
  playerId,
}: Submission): Validation {
  const game = boardGame(slug);
  if (!game) return { ok: false, reason: "game" };
  const rule = LEADERBOARD[game.slug]!;
  if (!isValidName(name)) return { ok: false, reason: "name" };
  if (
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < rule.min ||
    score > rule.max
  ) {
    return { ok: false, reason: "score" };
  }
  if (typeof playerId !== "string" || !UUID.test(playerId)) {
    return { ok: false, reason: "player" };
  }
  return {
    ok: true,
    game,
    name: name as string,
    score,
    playerId: playerId.toLowerCase(),
  };
}

/** True if `a` ranks above `b` for a game that goes in `direction`. */
export const beats = (a: number, b: number, direction: "high" | "low") =>
  direction === "high" ? a > b : a < b;

/**
 * Whether saving `score` would change the board. The server keeps one row per
 * player, so `mine` (the player's saved score, if any) must be beaten first.
 * A player whose row is still on a full board climbs by beating it.
 */
export function qualifies(
  board: readonly Entry[],
  score: number,
  direction: "high" | "low",
  mine?: { score: number; onBoard: boolean } | null,
): boolean {
  if (mine && !beats(score, mine.score, direction)) return false;
  if (mine?.onBoard) return true;
  if (board.length < BOARD_SIZE) return true;
  return beats(score, board[board.length - 1].score, direction);
}

/** 1-based rank `score` would get: after every entry it doesn't beat (ties go to the earlier save). */
export function rankOf(
  board: readonly Entry[],
  score: number,
  direction: "high" | "low",
): number {
  return (
    board.filter((entry) => !beats(score, entry.score, direction)).length + 1
  );
}
