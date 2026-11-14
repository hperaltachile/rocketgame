"use client";

import { formatBest, getGame } from "@/lib/games/registry";
import { hasLeaderboard } from "@/lib/leaderboard/rules";
import { useBoard } from "./store";
import { usePlayer } from "./usePlayer";

const MEDALS = ["🥇", "🥈", "🥉"];

/** The game's Top 10, under the board. Hidden when leaderboards are offline. */
export default function Leaderboard({ slug }: { slug: string }) {
  const game = getGame(slug);
  const { status, board } = useBoard(slug);
  const player = usePlayer();
  if (!game || !hasLeaderboard(slug) || status === "off") return null;
  const mine = player?.saved[slug];

  return (
    <section
      aria-labelledby="leaderboard-title"
      className="mx-auto mt-6 max-w-md rounded-2xl border border-line bg-surface p-4 sm:p-5"
    >
      <h2 id="leaderboard-title" className="font-display text-xl font-semibold">
        🏆 Top 10
      </h2>
      {status === "loading" ? (
        <p className="mt-2 text-sm text-muted">Loading the leaderboard…</p>
      ) : board.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No scores yet. Be the first!</p>
      ) : (
        <ol className="mt-3 space-y-1" data-leaderboard={slug}>
          {board.map((entry, i) => {
            const isMine =
              player !== null &&
              entry.name === player.name &&
              entry.score === mine;
            return (
              <li
                key={`${i}-${entry.name}`}
                className={`flex items-center gap-3 rounded-lg px-3 py-1.5 ${
                  isMine ? "bg-surface-2 font-semibold" : ""
                }`}
              >
                <span className="w-7 text-center text-muted tabular-nums">
                  {MEDALS[i] ?? i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {entry.name}
                  {isMine && <span className="sr-only"> (you)</span>}
                  {isMine && (
                    <span aria-hidden="true" className="ml-1 text-accent">
                      ← you
                    </span>
                  )}
                </span>
                <span className="tabular-nums">
                  {formatBest(game, entry.score)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-3 text-xs text-muted">
        Make the Top 10 to save your score with a space name.
      </p>
    </section>
  );
}
