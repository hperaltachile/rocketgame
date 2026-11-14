"use client";

import { useMemo } from "react";
import { useStoredRaw } from "@/components/hooks";
import { parsePlayer, PLAYER_KEY, type Player } from "@/lib/leaderboard/player";

/** The leaderboard player saved in this browser, or null if they haven't saved yet. */
export function usePlayer(): Player | null {
  const raw = useStoredRaw(PLAYER_KEY);
  return useMemo(() => parsePlayer(raw), [raw]);
}
