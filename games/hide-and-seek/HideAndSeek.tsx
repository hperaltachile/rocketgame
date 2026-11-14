"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import GameShell from "@/components/GameShell";
import PhaserGame from "@/components/PhaserGame";
import { ROUND } from "@/lib/games/hide-and-seek/config";
import { NO_INPUT, type Input } from "@/lib/games/hide-and-seek/state";
import type { Direction } from "@/lib/input";
import PixelLogo from "../shared/PixelLogo";
import Stage from "../shared/Stage";
import { usePhaserShell } from "../shared/usePhaserShell";
import type { HideCommand, HideState } from "./scenes";

// Phaser is only downloaded when this import runs (first Start).
const load = () => import("./createGame").then((m) => m.createGame);

type Control = "up" | "down" | "left" | "right" | "run";

/** Keyboard keys (by position, so they work on any layout). */
const KEYS: Record<string, Control> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ShiftLeft: "run",
  ShiftRight: "run",
};

const ACT_KEYS = new Set(["KeyE", "Space", "Enter"]);

const PAD: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export default function HideAndSeek() {
  const { bridge, state, status, loaded, shellProps } = usePhaserShell<
    Exclude<HideCommand, { type: "start" | "pause" | "resume" }>,
    HideState
  >("hide-and-seek");

  // Held controls from each source, combined into one Input for the game.
  const held = useRef({
    keys: new Set<Control>(),
    stick: null as [number, number] | null,
    last: "",
  });

  const sendInput = () => {
    const h = held.current;
    let x = 0;
    let y = 0;
    if (h.keys.has("left")) x -= 1;
    if (h.keys.has("right")) x += 1;
    if (h.keys.has("up")) y -= 1;
    if (h.keys.has("down")) y += 1;
    if (x === 0 && y === 0 && h.stick) [x, y] = h.stick;
    const input: Input = { x, y, run: h.keys.has("run") };
    const json = JSON.stringify(input);
    if (json === h.last) return;
    h.last = json;
    bridge.send({ type: "input", input });
  };

  const releaseAll = () => {
    const h = held.current;
    h.keys.clear();
    h.stick = null;
    h.last = JSON.stringify(NO_INPUT);
    bridge.send({ type: "input", input: NO_INPUT });
  };

  const start = () => {
    releaseAll();
    shellProps.onStart();
  };

  const onKey = useEffectEvent((event: KeyboardEvent, down: boolean) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const onButton = !!(event.target as HTMLElement).closest?.("button, a");
    if (ACT_KEYS.has(event.code)) {
      // Space/Enter on a focused button presses that button instead.
      if (!down || status !== "playing" || event.repeat) return;
      if (onButton && event.code !== "KeyE") return;
      event.preventDefault();
      bridge.send({ type: "act" });
      return;
    }
    const control = KEYS[event.code];
    if (!control) return;
    if (!down) {
      held.current.keys.delete(control);
      sendInput();
      return;
    }
    if (status !== "playing") return;
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

  const playing = status !== "ready" && state !== null;
  const exit = state?.prompt === "exit";
  const score = shellProps.score;
  const rounds = state?.roundsWon ?? 0;

  return (
    <GameShell
      {...shellProps}
      onStart={start}
      onRestart={start}
      aspect={3 / 2}
      maxWidth="42rem"
      landscape
      touch={{
        pad: true,
        actions: [
          exit
            ? { id: "act", label: state?.risky ? "Exit?" : "Exit", icon: "👀" }
            : { id: "act", label: "Hide", icon: "🙈" },
        ],
      }}
      onDirection={(dir) => {
        // Keyboard users of the on-page arrows: a short nudge.
        held.current.stick = status === "playing" && dir ? PAD[dir] : null;
        sendInput();
      }}
      onStick={(x, y) => {
        held.current.stick =
          status === "playing" && (x !== 0 || y !== 0) ? [x, y] : null;
        sendInput();
      }}
      onAction={(_id, pressed) => {
        if (pressed && status === "playing") bridge.send({ type: "act" });
      }}
      logo={
        <PixelLogo
          lines={["HIDE &", "SEEK"]}
          colors={["#e2fff4", "#7ee8c9", "#2a9d8f"]}
          className="mx-auto mb-3 w-full max-w-48"
        />
      }
      overTitle="The seeker found you!"
      overMessage={
        <>
          <p>
            {rounds === 0
              ? "Peeka found you in round 1."
              : `You stayed hidden for ${rounds} round${rounds === 1 ? "" : "s"}, then Peeka found you in round ${rounds + 1}.`}{" "}
            You scored {score.toLocaleString("en-US")} points
            {state?.closeCalls
              ? `, with ${state.closeCalls} close call${state.closeCalls === 1 ? "" : "s"}`
              : ""}
            .
          </p>
          {state?.hint && <p className="mt-2">💡 {state.hint}</p>}
        </>
      }
      howToPlay={
        <ul>
          <li>
            <strong>Move:</strong> arrow keys or <kbd>W</kbd> <kbd>A</kbd>{" "}
            <kbd>S</kbd> <kbd>D</kbd>. Hold <kbd>Shift</kbd> to run, but running
            is noisy!
          </li>
          <li>
            <strong>Hide:</strong> walk up to a glowing hiding spot and press{" "}
            <kbd>E</kbd> or <kbd>Space</kbd>. Press it again to come out.
          </li>
          <li>
            Peeka the robot counts to {ROUND.headStart}, then searches the house
            with a flashlight. Stay out of the beam: a <strong>?</strong> means
            Peeka is curious, a <strong>!</strong> means it saw you.
          </li>
          <li>
            Peeka can only find you by opening your spot. A green{" "}
            <strong>✓</strong> means it just checked that spot, so it&apos;s a
            safer place to sneak to for a while.
          </li>
          <li>
            Stay hidden for {Math.floor(ROUND.duration / 60)}:
            {String(ROUND.duration % 60).padStart(2, "0")} to win the round.
            Each round Peeka gets a little smarter, and it remembers your
            favourite spots!
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
        data-time={playing ? state.time : ""}
        data-round={playing ? state.round : ""}
        data-hidden={playing ? String(state.hidden) : ""}
        data-prompt={playing ? (state.prompt ?? "") : ""}
        data-seeker={playing ? state.seeker : ""}
      >
        {status === "playing" ? (state?.message ?? "") : ""}
      </p>
      <Stage
        loaded={loaded}
        poster={<span className="animate-float inline-block">🔦</span>}
      >
        <PhaserGame
          load={load}
          bridge={bridge}
          label="Hide and Seek: Mazes game. Move with the arrow keys, hide with E, run with Shift."
          className="size-full"
        />
      </Stage>
    </GameShell>
  );
}
