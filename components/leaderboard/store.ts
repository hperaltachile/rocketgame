"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Entry } from "@/lib/leaderboard/rules";

/**
 * One shared copy of each game's board per page, so the Top 10 under the game
 * and the save prompt on the game-over screen fetch once and update together.
 */
export type BoardState =
  | { status: "loading"; board: Entry[] }
  | { status: "ready"; board: Entry[] }
  /** No database, offline, or an error: leaderboards stay hidden. */
  | { status: "off"; board: Entry[] };

const LOADING: BoardState = { status: "loading", board: [] };
const states = new Map<string, BoardState>();
const listeners = new Set<() => void>();
const requested = new Set<string>();

function set(slug: string, state: BoardState) {
  states.set(slug, state);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const url = (slug: string) => `/api/leaderboard/${encodeURIComponent(slug)}`;

async function load(slug: string) {
  try {
    const response = await fetch(url(slug));
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as { board?: Entry[] };
    set(slug, { status: "ready", board: data.board ?? [] });
  } catch {
    set(slug, { status: "off", board: [] });
  }
}

export function useBoard(slug: string): BoardState {
  useEffect(() => {
    if (requested.has(slug)) return;
    requested.add(slug);
    void load(slug);
  }, [slug]);
  return useSyncExternalStore(
    subscribe,
    () => states.get(slug) ?? LOADING,
    () => LOADING,
  );
}

export type SaveResult =
  | { ok: true; rank: number | null; best: number }
  | { ok: false; error: "slow-down" | "failed" };

export async function saveScore(
  slug: string,
  body: { name: string; score: number; playerId: string },
): Promise<SaveResult> {
  try {
    const response = await fetch(url(slug), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 429) return { ok: false, error: "slow-down" };
    if (!response.ok) return { ok: false, error: "failed" };
    const data = (await response.json()) as {
      board: Entry[];
      rank: number | null;
      best: number;
    };
    set(slug, { status: "ready", board: data.board });
    return { ok: true, rank: data.rank, best: data.best };
  } catch {
    return { ok: false, error: "failed" };
  }
}
