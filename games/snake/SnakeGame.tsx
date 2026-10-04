"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import GameShell from "@/components/GameShell";
import PhaserGame from "@/components/PhaserGame";
import { DPad } from "@/components/TouchControls";
import { KEY_DIRECTIONS, type Direction } from "@/lib/input";
import Stage from "../shared/Stage";
import { usePhaserShell } from "../shared/usePhaserShell";

// Phaser is only downloaded when this import runs (first Start).
const load = () => import("./createGame").then((m) => m.createGame);

const SWIPE_MIN_PX = 20;

const TOUCH = { pad: true };

export default function SnakeGame() {
  const { bridge, status, loaded, shellProps } = usePhaserShell<{
    type: "turn";
    dir: Direction;
  }>("snake");
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const steer = (dir: Direction | null) => {
    if (dir && status === "playing") bridge.send({ type: "turn", dir });
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
      touch={TOUCH}
      onDirection={steer}
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
      below={
        <div className="hidden pointer-coarse:block">
          <DPad
            label="Steer the snake"
            onDirection={steer}
            className="mx-auto"
          />
        </div>
      }
    >
      <div
        className="size-full"
        onPointerDown={(e) =>
          (swipeStart.current = { x: e.clientX, y: e.clientY })
        }
        onPointerMove={onPointerMove}
        onPointerUp={() => (swipeStart.current = null)}
        onPointerCancel={() => (swipeStart.current = null)}
      >
        <Stage
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
    </GameShell>
  );
}
