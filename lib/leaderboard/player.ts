import { readRaw, writeJSON } from "@/lib/storage";
import { isValidName, randomName } from "./names";

/**
 * The player's leaderboard identity, kept in this browser only:
 * a random id (not personal), their space name, and the best score they've
 * saved per game (so we know which of their scores can still climb).
 */
export const PLAYER_KEY = "rocketgame:player";

export type Player = {
  id: string;
  name: string;
  saved: Record<string, number>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The stored player, repaired; null if there's none (or it's beyond repair). */
export function parsePlayer(raw: string | null): Player | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Partial<Player> | null;
    if (!value || typeof value.id !== "string" || !UUID.test(value.id)) {
      return null;
    }
    const saved: Record<string, number> = {};
    if (value.saved && typeof value.saved === "object") {
      for (const [slug, score] of Object.entries(value.saved)) {
        if (typeof score === "number" && Number.isFinite(score)) {
          saved[slug] = score;
        }
      }
    }
    return {
      id: value.id,
      name: isValidName(value.name) ? (value.name as string) : randomName(),
      saved,
    };
  } catch {
    return null;
  }
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Very old browsers: a random v4-shaped id is enough here.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.floor(Math.random() * 16);
      return (c === "x" ? r : (r & 3) | 8).toString(16);
    });
  }
}

export const readPlayer = () => parsePlayer(readRaw(PLAYER_KEY));

/** The stored player, or a new one with a random name (saved right away). */
export function ensurePlayer(): Player {
  const existing = readPlayer();
  if (existing) return existing;
  const player: Player = { id: newId(), name: randomName(), saved: {} };
  writeJSON(PLAYER_KEY, player);
  return player;
}

export function updatePlayer(patch: Partial<Omit<Player, "id">>): Player {
  const player = { ...ensurePlayer(), ...patch };
  writeJSON(PLAYER_KEY, player);
  return player;
}
