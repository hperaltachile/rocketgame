"use client";

import { useEffect, useState } from "react";
import GameShell, { type GameStatus } from "@/components/GameShell";
import { useGridFocus } from "@/components/useGridFocus";
import {
  flagsPlaced,
  newBoard,
  reveal,
  toggleFlag,
  type Board,
  type Cell,
} from "@/lib/games/minesweeper/logic";
import { getGame } from "@/lib/games/registry";
import { readBest, recordBest } from "@/lib/storage";

const INFO = getGame("minesweeper")!;
const ROWS = 9;
const COLS = 9;
const MINES = 10;

const NUMBER_COLORS = [
  "",
  "text-sky-700 dark:text-sky-300",
  "text-green-700 dark:text-green-300",
  "text-red-700 dark:text-red-300",
  "text-violet-700 dark:text-violet-300",
  "text-amber-800 dark:text-amber-300",
  "text-teal-700 dark:text-teal-300",
  "text-pink-700 dark:text-pink-300",
  "text-slate-700 dark:text-slate-300",
];

export default function Minesweeper() {
  const [board, setBoard] = useState<Board>(() => newBoard(ROWS, COLS, MINES));
  const [status, setStatus] = useState<GameStatus>("ready");
  const [seconds, setSeconds] = useState(0);
  const [flagMode, setFlagMode] = useState(false);
  const [bestAtStart, setBestAtStart] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const { cellProps } = useGridFocus(ROWS, COLS);

  // The clock runs from the first reveal until the game ends, and stops while paused.
  const running =
    status === "playing" && board.minesPlaced && board.state === "playing";
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const start = () => {
    setBoard(newBoard(ROWS, COLS, MINES));
    setSeconds(0);
    setFlagMode(false);
    setBestAtStart(readBest(INFO.slug));
    setAnnouncement("New game. Find the 10 mines.");
    setStatus("playing");
  };

  const finish = (next: Board) => {
    if (next.state === "won") {
      recordBest(INFO.slug, seconds, INFO.best.direction);
      setAnnouncement(`You cleared the field in ${seconds} seconds!`);
      setStatus("over");
    } else if (next.state === "lost") {
      setAnnouncement("Boom! You hit a mine.");
      setStatus("over");
    }
  };

  const open = (index: number) => {
    if (status !== "playing") return;
    const next = reveal(board, index);
    if (next === board) return;
    setBoard(next);
    const cell = next.cells[index];
    if (next.state === "playing") {
      setAnnouncement(
        cell.adjacent === 0
          ? "Opened an empty area."
          : `${cell.adjacent} mine${cell.adjacent === 1 ? "" : "s"} nearby.`,
      );
    }
    finish(next);
  };

  const flag = (index: number) => {
    if (status !== "playing") return;
    const next = toggleFlag(board, index);
    if (next === board) return;
    setBoard(next);
    setAnnouncement(
      next.cells[index].flagged ? "Flag placed." : "Flag removed.",
    );
  };

  const minesLeft = MINES - flagsPlaced(board);
  const won = board.state === "won";
  const isNewBest = won && (bestAtStart === null || seconds < bestAtStart);

  return (
    <GameShell
      game={INFO}
      status={status}
      stats={[
        { label: "Mines left", value: minesLeft },
        { label: "Time", value: `${seconds}s` },
      ]}
      onStart={start}
      onPause={() => setStatus("paused")}
      onResume={() => setStatus("playing")}
      onRestart={start}
      overTitle={won ? "Field cleared! 🎉" : "Boom! 💥"}
      overMessage={
        won ? (
          <p>You found every mine in {seconds} seconds.</p>
        ) : (
          <p>You stepped on a mine. Try again!</p>
        )
      }
      isNewBest={isNewBest}
      controls={
        <button
          type="button"
          className="btn-secondary"
          aria-pressed={flagMode}
          onClick={() => setFlagMode((on) => !on)}
        >
          <span aria-hidden="true">🚩</span>
          Flag mode: {flagMode ? "on" : "off"}
        </button>
      }
      howToPlay={
        <ul>
          <li>
            Tap or click a square to open it. Your first click is always safe.
          </li>
          <li>
            A number tells you how many mines touch that square (including
            corners). Use the numbers to work out where the mines are.
          </li>
          <li>
            Mark a mine with a flag: right-click, press <kbd>F</kbd>, or turn on{" "}
            <strong>Flag mode</strong> and tap.
          </li>
          <li>
            Keyboard: move with the arrow keys, open with <kbd>Enter</kbd> or{" "}
            <kbd>Space</kbd>.
          </li>
          <li>
            Open every square without a mine to win. Be quick — it&apos;s timed!
          </li>
        </ul>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div
        role="grid"
        aria-label="Minefield, 9 by 9"
        className="mx-auto grid w-full max-w-md gap-1 rounded-2xl bg-line p-2"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {Array.from({ length: ROWS }, (_, r) => (
          <div role="row" key={r} className="contents">
            {Array.from({ length: COLS }, (_, c) => {
              const index = r * COLS + c;
              const cell = board.cells[index];
              const focus = cellProps(index);
              return (
                <div role="gridcell" key={c} className="aspect-square">
                  <button
                    type="button"
                    {...focus}
                    aria-label={cellLabel(cell, r, c)}
                    className={cellClass(cell, index === board.exploded)}
                    onClick={() => (flagMode ? flag(index) : open(index))}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      flag(index);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "f" || e.key === "F") {
                        e.preventDefault();
                        flag(index);
                      } else {
                        focus.onKeyDown(e);
                      }
                    }}
                  >
                    <span aria-hidden="true">{cellText(cell)}</span>
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

function cellText(cell: Cell): string {
  if (cell.flagged) return "🚩";
  if (!cell.revealed) return "";
  if (cell.mine) return "💣";
  return cell.adjacent === 0 ? "" : String(cell.adjacent);
}

function cellLabel(cell: Cell, r: number, c: number): string {
  const where = `Row ${r + 1}, column ${c + 1}`;
  if (cell.flagged) return `${where}: flagged`;
  if (!cell.revealed) return `${where}: hidden`;
  if (cell.mine) return `${where}: mine`;
  if (cell.adjacent === 0) return `${where}: empty`;
  return `${where}: ${cell.adjacent} mine${cell.adjacent === 1 ? "" : "s"} nearby`;
}

function cellClass(cell: Cell, exploded: boolean): string {
  const base =
    "font-display flex size-full items-center justify-center rounded-md text-lg font-semibold sm:text-2xl";
  if (exploded) return `${base} bg-red-500 text-white`;
  if (cell.revealed && !cell.flagged) {
    return `${base} bg-surface ${NUMBER_COLORS[cell.adjacent] ?? ""}`;
  }
  return `${base} bg-surface-2 shadow-[inset_0_-3px_0_rgb(0_0_0/0.12)] hover:brightness-95 active:shadow-none`;
}
