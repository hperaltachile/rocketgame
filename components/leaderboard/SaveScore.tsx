"use client";

import { useState } from "react";
import type { GameInfo } from "@/lib/games/registry";
import { buildName, parseName, randomParts } from "@/lib/leaderboard/names";
import { ensurePlayer, updatePlayer } from "@/lib/leaderboard/player";
import { hasLeaderboard, qualifies, rankOf } from "@/lib/leaderboard/rules";
import NamePicker from "./NamePicker";
import { saveScore, useBoard } from "./store";
import { usePlayer } from "./usePlayer";

type Phase =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; rank: number | null }
  | { kind: "error"; message: string };

/**
 * Game-over prompt: "You made the Top 10!" with the player's space name and a
 * Save button. Shows nothing when the score doesn't make the board, or when
 * leaderboards are offline.
 */
export default function SaveScore({
  game,
  score,
}: {
  game: GameInfo;
  score: number;
}) {
  const { status, board } = useBoard(game.slug);
  const player = usePlayer();
  const [parts, setParts] = useState(
    () => parseName(player?.name) ?? randomParts(),
  );
  const [picking, setPicking] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  if (!hasLeaderboard(game.slug) || status !== "ready") return null;

  const direction = game.best.direction;
  const saved = player?.saved[game.slug];
  const mine =
    saved === undefined
      ? null
      : {
          score: saved,
          onBoard: board.some(
            (entry) => entry.name === player?.name && entry.score === saved,
          ),
        };
  const canSave = qualifies(board, score, direction, mine);

  if (phase.kind === "saved") {
    return (
      <p
        role="status"
        className="mt-3 rounded-lg bg-surface-2 px-3 py-2 font-semibold"
        data-leaderboard-saved={phase.rank ?? ""}
      >
        {phase.rank
          ? `Saved! You're #${phase.rank} on the Top 10. 🏆`
          : "Saved! 🏆"}
      </p>
    );
  }
  if (!canSave) return null;

  const name = buildName(parts);
  // The player's old row moves up rather than counting against them.
  const others = mine?.onBoard
    ? board.filter((e) => !(e.name === player?.name && e.score === saved))
    : board;
  const rank = rankOf(others, score, direction);

  const save = async () => {
    setPhase({ kind: "saving" });
    const me = ensurePlayer();
    updatePlayer({ name });
    const result = await saveScore(game.slug, {
      name,
      score,
      playerId: me.id,
    });
    if (result.ok) {
      const latest = ensurePlayer();
      updatePlayer({ saved: { ...latest.saved, [game.slug]: result.best } });
      setPhase({ kind: "saved", rank: result.rank });
    } else {
      setPhase({
        kind: "error",
        message:
          result.error === "slow-down"
            ? "Lots of saves! Wait a minute, then try again."
            : "Couldn't save right now. Try again?",
      });
    }
  };

  return (
    <div
      className="mt-3 rounded-xl border border-line p-3"
      data-leaderboard-save
    >
      <p className="font-semibold text-accent">
        You made the Top 10! 🏆{" "}
        <span className="text-muted">(#{Math.min(rank, 10)})</span>
      </p>
      <p className="mt-1 text-sm">
        Save as <span className="font-semibold">{name}</span>
        {!picking && (
          <>
            {" · "}
            <button
              type="button"
              // Padding grows the tap area to 44 px without moving the text.
              className="-my-3 rounded px-1 py-3 font-semibold text-accent-2 underline underline-offset-2"
              onClick={() => setPicking(true)}
            >
              Change name
            </button>
          </>
        )}
      </p>
      {picking && <NamePicker parts={parts} onChange={setParts} />}
      <button
        type="button"
        className="btn-secondary mt-2 w-full"
        disabled={phase.kind === "saving"}
        onClick={save}
      >
        {phase.kind === "saving" ? "Saving…" : "Save score"}
      </button>
      {phase.kind === "error" && (
        <p role="status" className="mt-2 text-sm text-muted">
          {phase.message}
        </p>
      )}
    </div>
  );
}
