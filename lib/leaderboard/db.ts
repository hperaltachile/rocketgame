// Server only: imported by app/api/leaderboard, never by client components.
import { createHash } from "node:crypto";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import type { GameInfo } from "@/lib/games/registry";
import { BOARD_SIZE, type Entry } from "./rules";

/** Saves allowed per IP in `RATE_WINDOW_SECONDS`. */
export const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 60;

export class NotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set");
  }
}

let pool: Pool | null = null;

function getPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new NotConfiguredError();
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 5 });
    // Lets Vercel Fluid compute close idle clients before the function suspends.
    attachDatabasePool(pool);
  }
  return pool;
}

const order = (game: GameInfo) =>
  game.best.direction === "high" ? "score desc" : "score asc";

export async function getTop(game: GameInfo): Promise<Entry[]> {
  const { rows } = await getPool().query<Entry>(
    `select name, score from scores where game = $1
     order by ${order(game)}, updated_at asc limit $2`,
    [game.slug, BOARD_SIZE],
  );
  return rows;
}

/** Salted, so the stored hash can't be matched back to an IP. */
export function hashIp(ip: string): string {
  const salt = process.env.LEADERBOARD_SALT ?? process.env.DATABASE_URL ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Records a save attempt and says whether this IP is over the limit. */
export async function overRateLimit(ipHash: string): Promise<boolean> {
  const db = getPool();
  // Housekeeping: hashes are kept for a day at most.
  if (Math.random() < 0.05) {
    await db.query(`delete from submits where at < now() - interval '1 day'`);
  }
  const { rows } = await db.query<{ n: string }>(
    `with ins as (insert into submits (ip_hash) values ($1))
     select count(*) as n from submits
     where ip_hash = $1 and at > now() - make_interval(secs => $2)`,
    [ipHash, RATE_WINDOW_SECONDS],
  );
  // The count doesn't include the row inserted by this same statement.
  return Number(rows[0].n) >= RATE_LIMIT;
}

/**
 * Saves the player's score if it beats their own (and always updates their
 * name). Returns the board afterwards and the player's rank on it, if any.
 */
export async function submitScore(
  game: GameInfo,
  playerId: string,
  name: string,
  score: number,
): Promise<{ board: Entry[]; rank: number | null; best: number }> {
  const better = game.best.direction === "high" ? ">" : "<";
  const db = getPool();
  const { rows } = await db.query<{ score: number }>(
    `insert into scores (game, player_id, name, score) values ($1, $2, $3, $4)
     on conflict (game, player_id) do update set
       name = excluded.name,
       score = case when excluded.score ${better} scores.score then excluded.score else scores.score end,
       updated_at = case when excluded.score ${better} scores.score then now() else scores.updated_at end
     returning score`,
    [game.slug, playerId, name, score],
  );
  const best = rows[0].score;
  const top = await db.query<Entry & { player_id: string }>(
    `select name, score, player_id from scores where game = $1
     order by ${order(game)}, updated_at asc limit $2`,
    [game.slug, BOARD_SIZE],
  );
  const index = top.rows.findIndex((row) => row.player_id === playerId);
  return {
    board: top.rows.map(({ name, score }) => ({ name, score })),
    rank: index < 0 ? null : index + 1,
    best,
  };
}
