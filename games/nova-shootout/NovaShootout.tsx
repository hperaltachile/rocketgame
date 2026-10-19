"use client";

import { useEffect, useEffectEvent } from "react";
import GameShell from "@/components/GameShell";
import { useStoredRaw } from "@/components/hooks";
import PhaserGame from "@/components/PhaserGame";
import {
  KICKS,
  type Difficulty,
  type Outcome,
} from "@/lib/games/nova-shootout/logic";
import { KEY_DIRECTIONS, type Direction } from "@/lib/input";
import { writeJSON } from "@/lib/storage";
import PixelLogo from "../shared/PixelLogo";
import Stage from "../shared/Stage";
import { usePhaserShell } from "../shared/usePhaserShell";
import type { KickState } from "./scenes";

// Phaser is only downloaded when this import runs (first Start).
const load = () => import("./createGame").then((m) => m.createGame);

const DIFFICULTY_KEY = "rocketgame:nova-shootout:difficulty";
const LEVELS: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

const TOUCH = {
  pad: true,
  actions: [{ id: "kick", label: "Kick", icon: "⚽" }],
};

/** Read out to screen readers; the canvas shows the same as pixel banners. */
const MESSAGES: Record<Outcome, string> = {
  goal: "GOAL! 🎉",
  saved: "Saved by Bolt! So close!",
  post: "Off the post! So close!",
  over: "Over the bar! So close!",
  wide: "Just wide! So close!",
};

const RESULT_ICON: Record<Outcome, string> = {
  goal: "⚽",
  saved: "✋",
  post: "✕",
  over: "✕",
  wide: "✕",
};

function parseDifficulty(raw: string | null): Difficulty {
  try {
    const value: unknown = raw === null ? null : JSON.parse(raw);
    return value === "medium" || value === "hard" ? value : "easy";
  } catch {
    return "easy";
  }
}

type Command =
  | { type: "setup"; difficulty: Difficulty }
  | { type: "steer"; dir: Direction | null }
  | { type: "kick" };

export default function NovaShootout() {
  const { bridge, state, status, loaded, shellProps } = usePhaserShell<
    Command,
    KickState
  >("nova-shootout");
  const difficulty = parseDifficulty(useStoredRaw(DIFFICULTY_KEY));

  const start = () => {
    bridge.send({ type: "setup", difficulty });
    shellProps.onStart();
  };

  const steer = (dir: Direction | null) => {
    if (status === "playing" || dir === null)
      bridge.send({ type: "steer", dir });
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (
      status !== "playing" ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    const dir = KEY_DIRECTIONS[event.key];
    if (dir) {
      event.preventDefault();
      if (!event.repeat) steer(dir);
      return;
    }
    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      // Space/Enter on a focused button presses that button instead.
      if ((event.target as HTMLElement).closest?.("button")) return;
      event.preventDefault();
      bridge.send({ type: "kick" });
    }
  });

  const onKeyUp = useEffectEvent((event: KeyboardEvent) => {
    if (KEY_DIRECTIONS[event.key]) steer(null);
  });

  useEffect(() => {
    const down = (event: KeyboardEvent) => onKeyDown(event);
    const up = (event: KeyboardEvent) => onKeyUp(event);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const goals = state?.goals ?? 0;
  const kicks = state?.kicks ?? 0;
  const playingRound = status !== "ready";
  // Hints ("TAP THE GOAL", "TAP TO SHOOT!") are on the stadium screen in the game.
  const message =
    state?.phase === "result" && state.last ? MESSAGES[state.last] : null;

  return (
    <GameShell
      {...shellProps}
      onStart={start}
      onRestart={start}
      score={goals}
      scoreLabel="Goals"
      stats={[
        { label: "Kicks", value: `${playingRound ? kicks : 0}/${KICKS}` },
        {
          label: "Round",
          value: (
            <span aria-label={`${goals} goals from ${kicks} kicks`}>
              {Array.from({ length: KICKS }, (_, i) => {
                const result = playingRound ? state?.results[i] : undefined;
                return (
                  <span
                    key={i}
                    aria-hidden="true"
                    className="inline-block w-5 text-center"
                  >
                    {result ? RESULT_ICON[result] : "·"}
                  </span>
                );
              })}
            </span>
          ),
        },
      ]}
      aspect={3 / 2}
      maxWidth="42rem"
      landscape
      touch={TOUCH}
      onDirection={steer}
      onAction={(id, pressed) => {
        if (id === "kick" && pressed && status === "playing") {
          bridge.send({ type: "kick" });
        }
      }}
      logo={
        <PixelLogo
          lines={["NOVA", "SHOOTOUT"]}
          colors={["#c8f4ff", "#4cc9f0", "#3a3fd1"]}
          className="mx-auto mb-3 w-full max-w-56"
        />
      }
      overTitle={
        goals >= 4
          ? "Champion! 🏆"
          : goals >= 2
            ? "Nice shooting! ⚽"
            : "Good try! ⚽"
      }
      overMessage={
        <p>
          You scored {goals} goal{goals === 1 ? "" : "s"} from {KICKS} kicks.
        </p>
      }
      controls={
        <div
          role="group"
          aria-label="Goalie level"
          className="flex flex-wrap gap-2"
        >
          {LEVELS.map((level) => (
            <button
              key={level.id}
              type="button"
              aria-pressed={difficulty === level.id}
              className={
                difficulty === level.id ? "btn-primary" : "btn-secondary"
              }
              onClick={() => writeJSON(DIFFICULTY_KEY, level.id)}
            >
              {level.label}
            </button>
          ))}
        </div>
      }
      howToPlay={
        <ul>
          <li>
            <strong>Aim:</strong> tap or click where you want to shoot in the
            goal. You can also move the target with the arrow keys or the arrow
            pad.
          </li>
          <li>
            <strong>Power:</strong> the power bar starts moving. Tap again, or
            press <kbd>Space</kbd>, to kick. Green is perfect. Too little and
            the goalie stops it easily; red sends it over the bar!
          </li>
          <li>
            Bolt the robot goalie dives to stop you. On Medium and Hard he
            guesses better and dives further, and he gets sharper every kick.
          </li>
          <li>You get 5 kicks. How many goals can you score?</li>
        </ul>
      }
    >
      <p
        role="status"
        aria-live="polite"
        className="sr-only"
        data-game-message
        data-phase={status === "playing" ? (state?.phase ?? "") : ""}
      >
        {message ?? ""}
      </p>
      <Stage
        loaded={loaded}
        poster={<span className="animate-float inline-block">⚽</span>}
      >
        <PhaserGame
          load={load}
          bridge={bridge}
          label="Nova Shootout game. Tap the goal to aim, then tap again to kick."
          className="size-full"
        />
      </Stage>
    </GameShell>
  );
}
