"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import GameShell from "@/components/GameShell";
import PhaserGame from "@/components/PhaserGame";
import type { Direction } from "@/lib/games/snake/logic";
import Stage from "../shared/Stage";
import { usePhaserShell } from "../shared/usePhaserShell";

// Phaser is only downloaded when this import runs (first Start).
const load = () => import("./createGame").then((m) => m.createGame);

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

const SWIPE_MIN_PX = 20;

export default function SnakeGame() {
  const { bridge, status, loaded, shellProps } = usePhaserShell<{
    type: "turn";
    dir: Direction;
  }>("snake");
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const steer = (dir: Direction) => {
    if (status === "playing") bridge.send({ type: "turn", dir });
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const dir = KEY_DIRECTIONS[event.key];
    if (!dir || status !== "playing") return;
    event.preventDefault();
    steer(dir);
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Swipes steer as soon as the finger has moved far enough.
  const onPointerMove = (event: React.PointerEvent) => {
    const origin = swipeStart.current;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) return;
    steer(
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "down"
          : "up",
    );
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };

  return (
    <GameShell
      {...shellProps}
      overTitle="Game over"
      overMessage={
        <p>
          You collected {shellProps.score} star
          {shellProps.score === 1 ? "" : "s"}.
        </p>
      }
      howToPlay={
        <ul>
          <li>
            Steer with the arrow keys or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd>{" "}
            <kbd>D</kbd>. On a phone or tablet, swipe on the board or use the
            arrow pad.
          </li>
          <li>Eat the stars to grow longer. Each star is 1 point.</li>
          <li>
            The longer you get, the faster you go. Don&apos;t hit the walls or
            your own tail!
          </li>
        </ul>
      }
    >
      <div
        className="mx-auto max-w-md"
        onPointerDown={(e) =>
          (swipeStart.current = { x: e.clientX, y: e.clientY })
        }
        onPointerMove={onPointerMove}
        onPointerUp={() => (swipeStart.current = null)}
        onPointerCancel={() => (swipeStart.current = null)}
      >
        <Stage
          aspect="1 / 1"
          loaded={loaded}
          poster={<span className="animate-float inline-block">🐍</span>}
        >
          <PhaserGame
            load={load}
            bridge={bridge}
            label="Snake game. Use arrow keys or swipe to steer."
            className="size-full"
          />
        </Stage>
      </div>

      <div
        role="group"
        aria-label="Steer the snake"
        className="mx-auto mt-4 hidden w-48 grid-cols-3 gap-2 pointer-coarse:grid"
      >
        <PadButton dir="up" label="↑" className="col-start-2" onPress={steer} />
        <PadButton
          dir="left"
          label="←"
          className="col-start-1 row-start-2"
          onPress={steer}
        />
        <PadButton
          dir="down"
          label="↓"
          className="col-start-2 row-start-2"
          onPress={steer}
        />
        <PadButton
          dir="right"
          label="→"
          className="col-start-3 row-start-2"
          onPress={steer}
        />
      </div>
    </GameShell>
  );
}

function PadButton({
  dir,
  label,
  className,
  onPress,
}: {
  dir: Direction;
  label: string;
  className: string;
  onPress: (dir: Direction) => void;
}) {
  return (
    <button
      type="button"
      className={`btn-secondary min-h-14 text-2xl ${className}`}
      aria-label={`Go ${dir}`}
      // pointerdown reacts faster than click on touch screens.
      onPointerDown={(e) => {
        e.preventDefault();
        onPress(dir);
      }}
      onClick={(e) => {
        // Keyboard activation (Enter/Space) still works.
        if (e.detail === 0) onPress(dir);
      }}
    >
      <span aria-hidden="true">{label}</span>
    </button>
  );
}
