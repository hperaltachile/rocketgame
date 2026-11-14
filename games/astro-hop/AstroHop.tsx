"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import GameShell from "@/components/GameShell";
import { useStoredRaw } from "@/components/hooks";
import PhaserGame from "@/components/PhaserGame";
import { LEVELS, type Theme } from "@/lib/games/astro-hop/levels";
import {
  NO_INPUT,
  parseUnlocked,
  type Input,
} from "@/lib/games/astro-hop/logic";
import type { Direction } from "@/lib/input";
import { writeJSON } from "@/lib/storage";
import PixelLogo from "../shared/PixelLogo";
import Stage from "../shared/Stage";
import { usePhaserShell } from "../shared/usePhaserShell";
import type { HopCommand, HopState } from "./scenes";

// Phaser is only downloaded when this import runs (first Start).
const load = () => import("./createGame").then((m) => m.createGame);

const UNLOCK_KEY = "rocketgame:astro-hop:unlocked";
const START_KEY = "rocketgame:astro-hop:start";

/** Keyboard keys (by position, so they work on any layout). */
const KEYS: Record<string, keyof Input> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "jump",
  ArrowUp: "jump",
  KeyW: "jump",
  KeyZ: "jump",
  KeyK: "jump",
  ShiftLeft: "run",
  ShiftRight: "run",
  KeyX: "run",
  KeyJ: "run",
};

const TOUCH = {
  pad: true,
  row: true,
  actions: [
    { id: "jump", label: "Jump", icon: "⬆️" },
    { id: "run", label: "Run", icon: "💨" },
  ],
};

/** A little picture per kind of level, for the compact world picker. */
const THEME_ICON: Record<Theme, string> = {
  plains: "🌿",
  caves: "💎",
  sky: "☁️",
  fortress: "🏰",
};

const titleCase = (name: string) =>
  name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function AstroHop() {
  const { bridge, state, status, loaded, shellProps } = usePhaserShell<
    Exclude<HopCommand, { type: "start" | "pause" | "resume" }>,
    HopState
  >("astro-hop");
  const unlocked = parseUnlocked(useStoredRaw(UNLOCK_KEY));
  const startLevel = Math.min(unlocked, parseUnlocked(useStoredRaw(START_KEY)));

  // Held controls from each source, combined into one Input for the game.
  const held = useRef({
    keys: new Set<keyof Input>(),
    pad: null as Direction | null,
    buttons: new Set<string>(),
    last: "",
  });

  const sendInput = () => {
    const h = held.current;
    const input: Input = {
      left: h.keys.has("left") || h.pad === "left",
      right: h.keys.has("right") || h.pad === "right",
      jump: h.keys.has("jump") || h.pad === "up" || h.buttons.has("jump"),
      run: h.keys.has("run") || h.buttons.has("run"),
    };
    const json = JSON.stringify(input);
    if (json === h.last) return;
    h.last = json;
    bridge.send({ type: "input", input });
  };

  const releaseAll = () => {
    const h = held.current;
    h.keys.clear();
    h.buttons.clear();
    h.pad = null;
    h.last = JSON.stringify(NO_INPUT);
    bridge.send({ type: "input", input: NO_INPUT });
  };

  const start = () => {
    releaseAll();
    bridge.send({ type: "setup", level: startLevel });
    shellProps.onStart();
  };

  const onKey = useEffectEvent((event: KeyboardEvent, down: boolean) => {
    const control = KEYS[event.code];
    if (!control) return;
    if (!down) {
      held.current.keys.delete(control);
      sendInput();
      return;
    }
    if (status !== "playing" || event.altKey || event.ctrlKey || event.metaKey)
      return;
    // Space/Enter on a focused button presses that button instead.
    if (
      control === "jump" &&
      event.code === "Space" &&
      (event.target as HTMLElement).closest?.("button")
    ) {
      return;
    }
    event.preventDefault();
    held.current.keys.add(control);
    sendInput();
  });

  useEffect(() => {
    const down = (event: KeyboardEvent) => onKey(event, true);
    const up = (event: KeyboardEvent) => onKey(event, false);
    const blur = () => releaseAll();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Let go of everything whenever play stops (pause, game over).
  const onStatus = useEffectEvent(() => {
    if (status !== "playing") releaseAll();
  });
  useEffect(() => onStatus(), [status]);

  // Remember the furthest world reached, so it can be picked next time.
  const levelIndex = state?.levelIndex ?? 0;
  useEffect(() => {
    if (levelIndex > unlocked) writeJSON(UNLOCK_KEY, levelIndex);
  }, [levelIndex, unlocked]);

  const playing = status !== "ready" && state !== null;
  const won = state?.phase === "won";
  const score = shellProps.score;

  return (
    <GameShell
      {...shellProps}
      onStart={start}
      onRestart={start}
      aspect={3 / 2}
      maxWidth="42rem"
      landscape
      touch={TOUCH}
      onDirection={(dir) => {
        held.current.pad = status === "playing" ? dir : null;
        sendInput();
      }}
      onAction={(id, pressed) => {
        if (pressed && status === "playing") held.current.buttons.add(id);
        else held.current.buttons.delete(id);
        sendInput();
      }}
      logo={
        <PixelLogo
          lines={["ASTRO", "HOP"]}
          colors={["#fff27a", "#ff9f1c", "#e8590c"]}
          className="mx-auto mb-3 w-full max-w-48"
        />
      }
      overTitle={won ? "You did it! 🚀" : "Out of lives!"}
      overMessage={
        won ? (
          <p>
            Kit made it through all {LEVELS.length} levels with{" "}
            {score.toLocaleString("en-US")} points!
          </p>
        ) : (
          <p>
            You scored {score.toLocaleString("en-US")} points and reached World{" "}
            {state?.world ?? "1-1"}: {titleCase(state?.name ?? LEVELS[0].name)}.
            Worlds you reach stay unlocked, so you can start there next time.
          </p>
        )
      }
      controls={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div
            role="group"
            aria-label="Start at world"
            className="flex flex-wrap gap-1.5"
          >
            {LEVELS.map((level, i) => {
              const locked = i > unlocked;
              const name = `World ${level.id}: ${titleCase(level.name)}`;
              return (
                <button
                  key={level.id}
                  type="button"
                  aria-pressed={startLevel === i}
                  aria-label={locked ? `${name} (locked)` : name}
                  title={name}
                  disabled={locked}
                  className={`${startLevel === i ? "btn-primary" : "btn-secondary"} min-w-11 px-2.5 tabular-nums`}
                  onClick={() => writeJSON(START_KEY, i)}
                >
                  <span aria-hidden="true">
                    {locked ? "🔒" : THEME_ICON[level.theme]} {level.id}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-sm opacity-80" aria-hidden="true">
            {titleCase(LEVELS[startLevel].name)}
          </p>
        </div>
      }
      howToPlay={
        <ul>
          <li>
            <strong>Move:</strong> <kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd>{" "}
            <kbd>D</kbd>. Hold <kbd>Shift</kbd> (or <kbd>X</kbd>) to run.
          </li>
          <li>
            <strong>Jump:</strong> <kbd>Space</kbd>, <kbd>↑</kbd> or{" "}
            <kbd>W</kbd>. Hold it longer to jump higher.
          </li>
          <li>
            Hop on Grumbles and Boing frogs to bop them. Hop on a Shellbot and
            it hides in its shell: kick the shell to knock out other enemies!
          </li>
          <li>
            Bump ⭐ blocks from below. A Star Seed makes Kit big (big Kit can
            break bricks), and a Comet Berry lets him throw sparks with Run.
          </li>
          <li>
            Collect star coins (100 gives an extra life), pass the green
            checkpoint, and reach the beacon pole before time runs out. Touch it
            high for more points, then Kit blasts off to the next world!
          </li>
          <li>
            <strong>Fortresses:</strong> don&apos;t touch the lava, and time
            your way past spinning fire bars and hopping lava blips. At the end,
            stomp Big Clank three times, or jump over it and press the power
            switch!
          </li>
        </ul>
      }
    >
      <p
        role="status"
        aria-live="polite"
        className="sr-only"
        data-game-message
        data-phase={status === "playing" ? (state?.phase ?? "") : ""}
        data-world={playing ? state.world : LEVELS[startLevel].id}
        data-time={playing ? state.time : ""}
        data-lives={playing ? state.lives : ""}
        data-boss={playing ? state.boss : ""}
      >
        {status === "playing" ? (state?.message ?? "") : ""}
      </p>
      <Stage
        loaded={loaded}
        poster={<span className="animate-float inline-block">🦊</span>}
      >
        <PhaserGame
          load={load}
          bridge={bridge}
          label="Astro Hop game. Move with the arrow keys, jump with Space, run with Shift."
          className="size-full"
        />
      </Stage>
    </GameShell>
  );
}
