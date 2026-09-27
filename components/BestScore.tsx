"use client";

import { formatBest, getGame } from "@/lib/games/registry";
import { useBest } from "./hooks";

export default function BestScore({ slug }: { slug: string }) {
  const best = useBest(slug);
  const game = getGame(slug);
  if (!game) return null;
  return (
    <p className="text-sm text-muted">
      {best === null ? (
        "Not played yet"
      ) : (
        <>
          {game.best.label}:{" "}
          <span className="font-semibold text-text tabular-nums">
            {formatBest(game, best)}
          </span>
        </>
      )}
    </p>
  );
}
