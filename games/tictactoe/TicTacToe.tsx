"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import GameShell, { type GameStatus } from "@/components/GameShell";
import { useStoredRaw } from "@/components/hooks";
import { useGridFocus } from "@/components/useGridFocus";
import { getGame } from "@/lib/games/registry";
import {
  computerMove,
  emptyBoard,
  emptyTally,
  isDraw,
  place,
  winner,
  type Board,
  type Difficulty,
  type Tally,
} from "@/lib/games/tictactoe/logic";
import { readJSON, recordBest, writeJSON } from "@/lib/storage";

const INFO = getGame("tictactoe")!;
const TALLY_KEY = "rocketgame:tictactoe:tally";
const DIFFICULTY_KEY = "rocketgame:tictactoe:difficulty";
const COMPUTER_DELAY_MS = 450;

type Outcome = "win" | "draw" | "loss";

function parseTally(raw: string | null): Tally {
  try {
    return raw
      ? { ...emptyTally(), ...(JSON.parse(raw) as Tally) }
      : emptyTally();
  } catch {
    return emptyTally();
  }
}

export default function TicTacToe() {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [status, setStatus] = useState<GameStatus>("ready");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const tallyRaw = useStoredRaw(TALLY_KEY);
  const tally = useMemo(() => parseTally(tallyRaw), [tallyRaw]);
  const difficultyRaw = useStoredRaw(DIFFICULTY_KEY);
  const difficulty: Difficulty = difficultyRaw === '"hard"' ? "hard" : "easy";
  const { cellProps } = useGridFocus(3, 3);

  const win = winner(board);
  const filled = board.filter(Boolean).length;
  // X always goes first, so it's the computer's turn when the counts differ.
  const computerTurn =
    status === "playing" && !win && !isDraw(board) && filled % 2 === 1;

  const end = (result: Outcome) => {
    const next = readJSON<Tally>(TALLY_KEY, emptyTally());
    const key =
      result === "win" ? "wins" : result === "draw" ? "draws" : "losses";
    const updated = { ...emptyTally(), ...next, [key]: (next[key] ?? 0) + 1 };
    writeJSON(TALLY_KEY, updated);
    recordBest(INFO.slug, updated.wins, "high");
    setOutcome(result);
    setStatus("over");
  };

  const settle = (next: Board) => {
    const w = winner(next);
    if (w) end(w.mark === "X" ? "win" : "loss");
    else if (isDraw(next)) end("draw");
  };

  const computerPlays = useEffectEvent(() => {
    const move = computerMove(board, difficulty);
    const next = place(board, move, "O");
    setBoard(next);
    setAnnouncement(
      `Computer played row ${Math.floor(move / 3) + 1}, column ${(move % 3) + 1}.`,
    );
    settle(next);
  });

  // The computer answers after a short pause (cancelled if the game is paused).
  useEffect(() => {
    if (!computerTurn) return;
    const id = window.setTimeout(() => computerPlays(), COMPUTER_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [computerTurn]);

  const play = (index: number) => {
    if (status !== "playing" || computerTurn || board[index] || win) return;
    const next = place(board, index, "X");
    setBoard(next);
    setAnnouncement(
      `You played row ${Math.floor(index / 3) + 1}, column ${(index % 3) + 1}.`,
    );
    settle(next);
  };

  const start = () => {
    setBoard(emptyBoard());
    setOutcome(null);
    setAnnouncement("New game. You are X. Your turn.");
    setStatus("playing");
  };

  const winningLine = new Set(win?.line ?? []);
  const titles: Record<Outcome, string> = {
    win: "You win! 🎉",
    draw: "It's a draw 🤝",
    loss: "The computer wins 🤖",
  };

  return (
    <GameShell
      game={INFO}
      status={status}
      hideBest
      stats={[
        { label: "Wins", value: tally.wins },
        { label: "Draws", value: tally.draws },
        { label: "Losses", value: tally.losses },
      ]}
      onStart={start}
      onPause={() => setStatus("paused")}
      onResume={() => setStatus("playing")}
      onRestart={start}
      callout={
        status === "playing" && (
          <span className="rounded-full bg-surface/90 px-3 py-1 text-sm font-semibold shadow">
            {computerTurn ? "Computer is thinking…" : "Your turn (X)"}
          </span>
        )
      }
      overTitle={outcome ? titles[outcome] : "Game over"}
      overMessage={
        <p>
          {tally.wins} win{tally.wins === 1 ? "" : "s"}, {tally.draws} draw
          {tally.draws === 1 ? "" : "s"}, {tally.losses} loss
          {tally.losses === 1 ? "" : "es"} so far.
        </p>
      }
      controls={
        <div role="group" aria-label="Difficulty" className="flex gap-2">
          {(["easy", "hard"] as const).map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={difficulty === level}
              className={difficulty === level ? "btn-primary" : "btn-secondary"}
              onClick={() => writeJSON(DIFFICULTY_KEY, level)}
            >
              {level === "easy" ? "Easy" : "Hard"}
            </button>
          ))}
        </div>
      }
      howToPlay={
        <ul>
          <li>You are X and go first. The computer is O.</li>
          <li>
            Get three in a row — across, down or corner to corner — to win.
          </li>
          <li>
            <strong>Easy</strong>: the computer picks random squares.{" "}
            <strong>Hard</strong>: it never loses. Can you get a draw?
          </li>
          <li>
            Keyboard: move with the arrow keys, play with <kbd>Enter</kbd> or{" "}
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
        aria-label="Tic-Tac-Toe board"
        className="grid size-full grid-cols-3 grid-rows-3 gap-[2cqw] rounded-2xl bg-line p-[2cqw]"
      >
        {[0, 1, 2].map((r) => (
          <div role="row" key={r} className="contents">
            {[0, 1, 2].map((c) => {
              const index = r * 3 + c;
              const mark = board[index];
              return (
                <div role="gridcell" key={c}>
                  <button
                    type="button"
                    {...cellProps(index)}
                    aria-label={`Row ${r + 1}, column ${c + 1}: ${mark ?? "empty"}`}
                    aria-disabled={!!mark || computerTurn}
                    className={`flex size-full items-center justify-center rounded-xl font-display text-[18cqw] font-semibold ${
                      winningLine.has(index)
                        ? "bg-accent text-on-accent"
                        : `bg-surface ${mark === "X" ? "text-accent" : "text-accent-2"}`
                    }`}
                    onClick={() => play(index)}
                  >
                    <span aria-hidden="true">
                      {mark === "X" ? "✕" : mark === "O" ? "○" : ""}
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
