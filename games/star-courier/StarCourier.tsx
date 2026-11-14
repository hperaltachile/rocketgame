"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import GameShell from "@/components/GameShell";
import {
  useCoarsePointer,
  usePortrait,
  useStoredRaw,
} from "@/components/hooks";
import ThreeGame from "@/components/ThreeGame";
import { SECTORS } from "@/lib/games/star-courier/chunks";
import {
  COURIERS,
  getCourier,
  type CourierId,
} from "@/lib/games/star-courier/couriers";
import type { Action } from "@/lib/games/star-courier/logic";
import {
  WORLDS,
  getWorld,
  worldOfTheDay,
} from "@/lib/games/star-courier/worlds";
import { KEY_DIRECTIONS, type Direction } from "@/lib/input";
import { writeJSON } from "@/lib/storage";
import PixelLogo from "../shared/PixelLogo";
import Stage from "../shared/Stage";
import { usePhaserShell } from "../shared/usePhaserShell";
import type { CourierCommand, CourierState } from "./createGame";
import Hud from "./Hud";

// Three.js is only downloaded when this import runs (first Start).
const load = () => import("./createGame").then((m) => m.createGame);

const COURIER_KEY = "rocketgame:star-courier:courier";
const WORLD_KEY = "rocketgame:star-courier:world";
const SWIPE_MIN_PX = 24;
const TOUCH = { pad: true };

const ACTIONS: Record<Direction, Action> = {
  up: "up",
  down: "down",
  left: "left",
  right: "right",
};

function parseId(raw: string | null): string | null {
  try {
    const value: unknown = raw === null ? null : JSON.parse(raw);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

export default function StarCourier() {
  const { bridge, state, status, loaded, shellProps } = usePhaserShell<
    Exclude<CourierCommand, { type: "start" | "pause" | "resume" }>,
    CourierState
  >("star-courier");
  const courier = getCourier(parseId(useStoredRaw(COURIER_KEY)));
  const savedWorld = parseId(useStoredRaw(WORLD_KEY));
  const world = savedWorld ? getWorld(savedWorld) : worldOfTheDay(new Date());
  const coarse = useCoarsePointer();
  const portrait = usePortrait();
  const tall = coarse && portrait;
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const lastPad = useRef<Direction | null>(null);

  const start = () => {
    bridge.send({ type: "setup", world: world.id, courier: courier.id });
    shellProps.onStart();
  };

  const move = (action: Action) => {
    if (status === "playing") bridge.send({ type: "move", action });
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (status !== "playing" || event.altKey || event.ctrlKey || event.metaKey)
      return;
    const dir = KEY_DIRECTIONS[event.key];
    if (dir) {
      event.preventDefault();
      if (!event.repeat) move(ACTIONS[dir]);
      return;
    }
    if (event.key === " " && !event.repeat) {
      // Space on a focused button presses that button instead.
      if ((event.target as HTMLElement).closest?.("button")) return;
      event.preventDefault();
      move("up");
    }
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // One move per swipe, as soon as the finger has gone far enough.
  const onPointerMove = (event: React.PointerEvent) => {
    const origin = swipeStart.current;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) return;
    move(
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "down"
          : "up",
    );
    swipeStart.current = null;
  };

  const phase = status === "ready" ? "ready" : (state?.phase ?? "running");
  const distance = status === "ready" ? 0 : (state?.distance ?? 0);
  const stardust = status === "ready" ? 0 : (state?.stardust ?? 0);
  const sector = status === "ready" ? 0 : (state?.sector ?? 0);

  return (
    <GameShell
      {...shellProps}
      onStart={start}
      onRestart={start}
      stats={[
        { label: "Stardust", value: stardust.toLocaleString("en-US") },
        { label: "Distance", value: `${distance.toLocaleString("en-US")} m` },
      ]}
      aspect={tall ? 3 / 4 : 16 / 10}
      maxWidth={tall ? "28rem" : "48rem"}
      touch={TOUCH}
      onDirection={(dir) => {
        if (dir && dir !== lastPad.current) move(ACTIONS[dir]);
        lastPad.current = dir;
      }}
      logo={
        <PixelLogo
          lines={["STAR", "COURIER"]}
          colors={["#fff3b0", "#ffb547", "#ff5e3a"]}
          className="mx-auto mb-3 w-full max-w-56"
        />
      }
      overTitle={phase === "crash" ? "Bonk! 💫" : "Gooped! 🟢"}
      overMessage={
        <p>
          You ran {distance.toLocaleString("en-US")} m, reached{" "}
          {SECTORS[sector].name
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase())}{" "}
          and collected {stardust.toLocaleString("en-US")} stardust.
        </p>
      }
      controls={
        <div className="flex flex-col gap-3">
          <div
            role="group"
            aria-label="Courier"
            className="flex flex-wrap gap-2"
          >
            {COURIERS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={courier.id === c.id}
                title={c.blurb}
                className={
                  courier.id === c.id ? "btn-primary" : "btn-secondary"
                }
                onClick={() => writeJSON(COURIER_KEY, c.id satisfies CourierId)}
              >
                <span aria-hidden="true">{c.icon}</span> {c.name}
              </button>
            ))}
          </div>
          <div role="group" aria-label="World" className="flex flex-wrap gap-2">
            {WORLDS.map((w) => (
              <button
                key={w.id}
                type="button"
                aria-pressed={world.id === w.id}
                title={w.blurb}
                className={world.id === w.id ? "btn-primary" : "btn-secondary"}
                onClick={() => writeJSON(WORLD_KEY, w.id)}
              >
                {w.name}
              </button>
            ))}
          </div>
        </div>
      }
      howToPlay={
        <ul>
          <li>
            You&apos;re a space courier racing parcels along the Ring Rail.
            Gloop the giant jelly wants a hug, so keep running!
          </li>
          <li>
            <strong>Move:</strong> swipe left or right, or press <kbd>←</kbd>{" "}
            <kbd>→</kbd> (or <kbd>A</kbd> <kbd>D</kbd>), to change lanes.
          </li>
          <li>
            <strong>Jump</strong> over crates and craters: swipe up, or press{" "}
            <kbd>↑</kbd>, <kbd>W</kbd> or <kbd>Space</kbd>.{" "}
            <strong>Slide</strong> under laser gates: swipe down, or press{" "}
            <kbd>↓</kbd> or <kbd>S</kbd>. Down in the air drops you fast.
          </li>
          <li>
            Go around big cargo pods and freighters (watch for the blinking ⚠️).
            Bumping a crate makes you stumble; two stumbles close together and
            Gloop catches you!
          </li>
          <li>
            Grab power-ups: 💨 Warp Dash, 🧲 Star Magnet, 👢 Moon Boots, ✨ Twin
            Stars (double points) and 🫧 Bubble Shield.
          </li>
        </ul>
      }
    >
      <p
        role="status"
        aria-live="polite"
        className="sr-only"
        data-game-message={state?.message ?? ""}
        data-phase={phase}
      >
        {status === "playing" || status === "over"
          ? (state?.message ?? "")
          : ""}
      </p>
      <div
        className="relative size-full"
        onPointerDown={(e) =>
          (swipeStart.current = { x: e.clientX, y: e.clientY })
        }
        onPointerMove={onPointerMove}
        onPointerUp={() => (swipeStart.current = null)}
        onPointerCancel={() => (swipeStart.current = null)}
      >
        <Stage
          loaded={loaded}
          poster={<span className="animate-float inline-block">📦</span>}
        >
          <ThreeGame
            load={load}
            bridge={bridge}
            label="Star Courier game. Swipe or use the arrow keys to change lanes, jump and slide."
            className="size-full"
          />
          {status !== "ready" && <Hud state={state} />}
        </Stage>
      </div>
    </GameShell>
  );
}
