"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import GameShell, { type GameStatus } from "@/components/GameShell";
import { getGame } from "@/lib/games/registry";
import {
  move,
  newGame,
  toGrid,
  type Direction,
  type Game,
  type Tile,
} from "@/lib/games/2048/logic";
import { readBest, recordBest } from "@/lib/storage";

const INFO = getGame("2048")!;

/** Board geometry in % of the board's width: 4 tiles and 5 gaps. */
const GAP = 2.5;
const TILE = (100 - 5 * GAP) / 4;
/** One cell step as a % of the tile's own size (what translate() % uses). */
const STEP = ((TILE + GAP) / TILE) * 100;

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

const SWIPE_MIN_PX = 24;

const TILE_COLORS: Record<number, [bg: string, fg: string]> = {
  2: ["#c7d2fe", "#1b2350"],
  4: ["#a5b4fc", "#1b2350"],
  8: ["#ffc38a", "#3b1a00"],
  16: ["#ff9f5a", "#3b1a00"],
  32: ["#ff7a45", "#2a0f00"],
  64: ["#e0431f", "#ffffff"],
  128: ["#ffd166", "#3b2a00"],
  256: ["#fcbf49", "#3b2a00"],
  512: ["#f7a91a", "#3b2a00"],
  1024: ["#a78bfa", "#1a0b40"],
  2048: ["#7c3aed", "#ffffff"],
};
const SUPER_TILE: [string, string] = ["#4cc9f0", "#0b1026"];

function fontSize(value: number): string {
  const digits = String(value).length;
  if (digits <= 2) return "text-3xl sm:text-5xl";
  if (digits === 3) return "text-2xl sm:text-4xl";
  if (digits === 4) return "text-xl sm:text-3xl";
  return "text-lg sm:text-2xl";
}

export default function Game2048() {
  const [game, setGame] = useState<Game | null>(null);
  const [status, setStatus] = useState<GameStatus>("ready");
  const [bestAtStart, setBestAtStart] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const start = () => {
    setGame(newGame());
    setBestAtStart(readBest(INFO.slug));
    setAnnouncement("New game started.");
    setStatus("playing");
  };

  const play = (dir: Direction) => {
    if (status !== "playing" || !game) return;
    const next = move(game, dir);
    if (next === game) return;
    setGame(next);
    if (next.score > game.score) {
      recordBest(INFO.slug, next.score, INFO.best.direction);
    }
    const messages = [`Moved ${dir}. Score ${next.score}.`];
    if (next.won && !game.won) messages.push("You made 2048! Keep going.");
    if (next.over) {
      messages.push("No moves left.");
      setStatus("over");
    }
    setAnnouncement(messages.join(" "));
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const dir = KEY_DIRECTIONS[event.key];
    if (!dir || status !== "playing") return;
    event.preventDefault();
    play(dir);
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const onPointerDown = (event: React.PointerEvent) => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const origin = swipeStart.current;
    swipeStart.current = null;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) return;
    if (Math.abs(dx) > Math.abs(dy)) play(dx > 0 ? "right" : "left");
    else play(dy > 0 ? "down" : "up");
  };

  const score = game?.score ?? 0;
  const isNewBest =
    status === "over" &&
    score > 0 &&
    (bestAtStart === null || score > bestAtStart);

  return (
    <GameShell
      game={INFO}
      status={status}
      score={score}
      onStart={start}
      onPause={() => setStatus("paused")}
      onResume={() => setStatus("playing")}
      onRestart={start}
      overTitle="No more moves"
      overMessage={<p>You scored {score.toLocaleString("en-US")} points.</p>}
      isNewBest={isNewBest}
      howToPlay={
        <ul>
          <li>
            Use the <kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> arrow
            keys (or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>), swipe
            on the board, or tap the arrow buttons.
          </li>
          <li>
            All tiles slide as far as they can. Two tiles with the same number
            merge into one, and their sum is added to your score.
          </li>
          <li>
            A new 2 or 4 appears after every move. Make a 2048 tile to win —
            then keep going for a higher score!
          </li>
        </ul>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {game?.won && (
        <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-center font-semibold">
          🎉 You made 2048! Keep going.
        </p>
      )}

      <div
        className="relative mx-auto aspect-square w-full max-w-md touch-none rounded-2xl bg-line select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipeStart.current = null)}
      >
        {Array.from({ length: 16 }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="absolute rounded-xl bg-surface-2"
            style={{
              width: `${TILE}%`,
              height: `${TILE}%`,
              left: `${GAP + (i % 4) * (TILE + GAP)}%`,
              top: `${GAP + Math.floor(i / 4) * (TILE + GAP)}%`,
            }}
          />
        ))}
        {game?.tiles.map((tile) => (
          <TileView key={tile.id} tile={tile} />
        ))}
      </div>

      {game && <BoardTable game={game} />}

      <div
        className="mx-auto mt-4 grid w-44 grid-cols-3 gap-2"
        role="group"
        aria-label="Move tiles"
      >
        <ArrowButton dir="up" label="↑" className="col-start-2" onMove={play} />
        <ArrowButton
          dir="left"
          label="←"
          className="col-start-1 row-start-2"
          onMove={play}
        />
        <ArrowButton
          dir="down"
          label="↓"
          className="col-start-2 row-start-2"
          onMove={play}
        />
        <ArrowButton
          dir="right"
          label="→"
          className="col-start-3 row-start-2"
          onMove={play}
        />
      </div>
    </GameShell>
  );
}

function TileView({ tile }: { tile: Tile }) {
  const [bg, fg] = TILE_COLORS[tile.value] ?? SUPER_TILE;
  const animation =
    tile.kind === "new"
      ? "animate-tile-appear"
      : tile.kind === "merged"
        ? "animate-tile-merge"
        : "";
  return (
    <div
      aria-hidden="true"
      className="absolute transition-transform duration-100 ease-in-out"
      style={{
        width: `${TILE}%`,
        height: `${TILE}%`,
        left: `${GAP}%`,
        top: `${GAP}%`,
        transform: `translate(${tile.col * STEP}%, ${tile.row * STEP}%)`,
        zIndex: tile.kind === "consumed" ? 1 : 2,
      }}
    >
      <div
        className={`flex size-full items-center justify-center rounded-xl font-display font-semibold tabular-nums shadow-sm ${fontSize(tile.value)} ${animation}`}
        style={{ backgroundColor: bg, color: fg }}
      >
        {tile.value}
      </div>
    </div>
  );
}

/** Screen-reader view of the board. */
function BoardTable({ game }: { game: Game }) {
  const grid = toGrid(game);
  return (
    <table className="sr-only">
      <caption>2048 board</caption>
      <tbody>
        {grid.map((row, r) => (
          <tr key={r}>
            {row.map((value, c) => (
              <td key={c}>{value === 0 ? "empty" : value}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ArrowButton({
  dir,
  label,
  className,
  onMove,
}: {
  dir: Direction;
  label: string;
  className: string;
  onMove: (dir: Direction) => void;
}) {
  return (
    <button
      type="button"
      className={`btn-secondary text-xl ${className}`}
      aria-label={`Move ${dir}`}
      onClick={() => onMove(dir)}
    >
      <span aria-hidden="true">{label}</span>
    </button>
  );
}
