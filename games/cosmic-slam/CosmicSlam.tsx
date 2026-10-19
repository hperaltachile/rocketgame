"use client";

import { useEffect, useEffectEvent } from "react";
import GameShell from "@/components/GameShell";
import PhaserGame from "@/components/PhaserGame";
import {
  OUTS_PER_GAME,
  STRIKES_PER_OUT,
  type SwingResult,
} from "@/lib/games/cosmic-slam/logic";
import PixelLogo from "../shared/PixelLogo";
import Stage from "../shared/Stage";
import { usePhaserShell } from "../shared/usePhaserShell";
import type { SluggerState } from "./scenes";

// Phaser is only downloaded when this import runs (first Start).
const load = () => import("./createGame").then((m) => m.createGame);

const TOUCH = { actions: [{ id: "swing", label: "Swing", icon: "🏏" }] };

/** Read out to screen readers; the canvas shows the same as pixel banners. */
const MESSAGES: Record<SwingResult, string> = {
  homeRun: "HOME RUN! 🎆",
  hit: "Nice hit! ⭐",
  foul: "Foul ball!",
  strike: "Strike!",
};

/** ●●○ style counter for strikes and outs. */
function Dots({
  filled,
  total,
  label,
}: {
  filled: number;
  total: number;
  label: string;
}) {
  return (
    <span aria-label={`${filled} ${label}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`mr-1 inline-block size-3 rounded-full ${
            i < filled ? "bg-accent" : "border-2 border-current opacity-40"
          }`}
        />
      ))}
    </span>
  );
}

export default function CosmicSlam() {
  const { bridge, state, status, loaded, shellProps } = usePhaserShell<
    { type: "swing" },
    SluggerState
  >("cosmic-slam");

  const swing = () => {
    if (status === "playing") bridge.send({ type: "swing" });
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (status !== "playing" || event.repeat) return;
    if (event.key !== " " && event.key !== "Enter") return;
    // Space/Enter on a focused button presses that button instead.
    if ((event.target as HTMLElement).closest?.("button")) return;
    event.preventDefault();
    swing();
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const started = status !== "ready" && state !== null;
  const count = started ? state.count : null;
  const message =
    state?.phase === "result" && state.last ? MESSAGES[state.last] : null;
  // The pitch speed ("SLOW PITCH", "FAST PITCH!") shows on the scoreboard in the game.
  const hits = count?.hits ?? 0;
  const homeRuns = count?.homeRuns ?? 0;

  return (
    <GameShell
      {...shellProps}
      stats={[
        { label: "Hits", value: hits },
        { label: "Home runs", value: homeRuns },
        {
          label: "Strikes",
          value: (
            <Dots
              filled={count?.strikes ?? 0}
              total={STRIKES_PER_OUT}
              label="strikes"
            />
          ),
        },
        {
          label: "Outs",
          value: (
            <Dots
              filled={count?.outs ?? 0}
              total={OUTS_PER_GAME}
              label="outs"
            />
          ),
        },
      ]}
      aspect={3 / 2}
      maxWidth="42rem"
      landscape
      touch={TOUCH}
      onAction={(id, pressed) => {
        if (id === "swing" && pressed) swing();
      }}
      logo={
        <PixelLogo
          lines={["COSMIC", "SLAM"]}
          colors={["#fff27a", "#ff9f1c", "#e8590c"]}
          className="mx-auto mb-3 w-full max-w-48"
        />
      }
      overTitle="Three outs! ⚾"
      overMessage={
        <p>
          {hits} hit{hits === 1 ? "" : "s"} and {homeRuns} home run
          {homeRuns === 1 ? "" : "s"}: {shellProps.score} point
          {shellProps.score === 1 ? "" : "s"}.
        </p>
      }
      howToPlay={
        <ul>
          <li>
            The Moon Pitcher throws the ball. Swing when it reaches the glowing
            ring over the plate: click or tap anywhere on the game, press{" "}
            <kbd>Space</kbd>, or use the <strong>Swing</strong> button.
          </li>
          <li>
            Perfect timing is a <strong>home run</strong> (4 points). Good
            timing is a <strong>hit</strong> (1 point). A bit early or late is a
            foul; way off, or no swing, is a strike.
          </li>
          <li>
            3 strikes make an out, and 3 outs end the game. A foul never counts
            as strike 3.
          </li>
          <li>
            The scoreboard tells you if a pitch is slow, medium or fast. The
            more you score, the faster they come!
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
        data-pitch={state?.pitch?.travelMs ?? ""}
      >
        {message ?? ""}
      </p>
      <Stage
        loaded={loaded}
        poster={<span className="animate-float inline-block">⚾</span>}
      >
        <PhaserGame
          load={load}
          bridge={bridge}
          label="Cosmic Slam game. Tap or press Space to swing."
          className="size-full"
        />
      </Stage>
    </GameShell>
  );
}
