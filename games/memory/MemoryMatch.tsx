"use client";

import { useEffect, useState } from "react";
import GameShell, { type GameStatus } from "@/components/GameShell";
import { useGridFocus } from "@/components/useGridFocus";
import {
  flip,
  hideMismatch,
  isComplete,
  isMismatch,
  newGame,
  PAIRS,
  SYMBOLS,
  type Memory,
} from "@/lib/games/memory/logic";
import { getGame } from "@/lib/games/registry";
import { readBest, recordBest } from "@/lib/storage";

const INFO = getGame("memory")!;
const MISMATCH_MS = 900;

export default function MemoryMatch() {
  // Deal on Start (not during render) so server and browser HTML match.
  const [game, setGame] = useState<Memory | null>(null);
  const [status, setStatus] = useState<GameStatus>("ready");
  const [bestAtStart, setBestAtStart] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const { cellProps } = useGridFocus(4, 4);

  // Turn a mismatched pair back over after a moment (not while paused).
  const showingMismatch = !!game && isMismatch(game) && status === "playing";
  useEffect(() => {
    if (!showingMismatch) return;
    const id = window.setTimeout(
      () => setGame((g) => (g ? hideMismatch(g) : g)),
      MISMATCH_MS,
    );
    return () => window.clearTimeout(id);
  }, [showingMismatch]);

  const start = () => {
    setGame(newGame());
    setBestAtStart(readBest(INFO.slug));
    setAnnouncement("New game. Find the 8 pairs.");
    setStatus("playing");
  };

  const turn = (index: number) => {
    if (status !== "playing" || !game) return;
    const next = flip(game, index);
    if (next === game) return;
    setGame(next);
    const name = SYMBOLS[next.cards[index].symbol].name;
    if (next.pairs > game.pairs) {
      setAnnouncement(
        `${name}. It's a match! ${next.pairs} of ${PAIRS} pairs.`,
      );
    } else if (isMismatch(next)) {
      setAnnouncement(`${name}. Not a match.`);
    } else {
      setAnnouncement(name);
    }
    if (isComplete(next)) {
      recordBest(INFO.slug, next.moves, INFO.best.direction);
      setStatus("over");
    }
  };

  const moves = game?.moves ?? 0;
  const isNewBest =
    status === "over" && (bestAtStart === null || moves < bestAtStart);

  return (
    <GameShell
      game={INFO}
      status={status}
      stats={[
        { label: "Moves", value: moves },
        { label: "Pairs", value: `${game?.pairs ?? 0}/${PAIRS}` },
      ]}
      onStart={start}
      onPause={() => setStatus("paused")}
      onResume={() => setStatus("playing")}
      onRestart={start}
      overTitle="All pairs found! 🎉"
      overMessage={<p>You did it in {moves} moves.</p>}
      isNewBest={isNewBest}
      howToPlay={
        <ul>
          <li>Tap a card to turn it over, then tap another one.</li>
          <li>
            If the two pictures match, they stay face up. If not, they turn
            back.
          </li>
          <li>
            Find all 8 pairs in as few moves as you can. A move is two cards.
          </li>
          <li>
            Keyboard: move with the arrow keys, flip with <kbd>Enter</kbd> or{" "}
            <kbd>Space</kbd>.
          </li>
        </ul>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div
        role="grid"
        aria-label="Memory cards, 4 by 4"
        className="grid size-full grid-cols-4 grid-rows-4 gap-[2.5cqw]"
      >
        {[0, 1, 2, 3].map((r) => (
          <div role="row" key={r} className="contents">
            {[0, 1, 2, 3].map((c) => {
              const index = r * 4 + c;
              const card = game?.cards[index];
              const up = !!card && (card.faceUp || card.matched);
              const symbol = card ? SYMBOLS[card.symbol] : null;
              return (
                <div role="gridcell" key={c} className="flip-card">
                  <button
                    type="button"
                    {...cellProps(index)}
                    aria-label={
                      up && symbol
                        ? `Card ${index + 1}: ${symbol.name}${card?.matched ? ", matched" : ""}`
                        : `Card ${index + 1}: face down`
                    }
                    className={`flip-inner size-full rounded-xl ${up ? "is-flipped" : ""}`}
                    onClick={() => turn(index)}
                  >
                    <span
                      aria-hidden="true"
                      className="flip-face flex items-center justify-center rounded-xl border-2 border-line bg-surface-2 text-[7cqw]"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle at 30% 30%, rgb(255 255 255 / 0.25) 0 2px, transparent 3px), radial-gradient(circle at 70% 65%, rgb(255 255 255 / 0.2) 0 1.5px, transparent 2.5px)",
                      }}
                    >
                      <span className="opacity-60">✦</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flip-face flip-back flex items-center justify-center rounded-xl border-2 text-[12cqw] ${
                        card?.matched
                          ? "border-accent bg-surface"
                          : "border-line bg-surface"
                      }`}
                    >
                      {symbol?.icon}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </GameShell>
  );
}
