"use client";

import { useEffect, useEffectEvent } from "react";
import GameShell from "@/components/GameShell";
import PhaserGame from "@/components/PhaserGame";
import Stage from "../shared/Stage";
import { usePhaserShell } from "../shared/usePhaserShell";

// Phaser is only downloaded when this import runs (first Start).
const load = () => import("./createGame").then((m) => m.createGame);

const BOOST_KEYS = new Set([" ", "ArrowUp", "w", "W"]);

export default function RocketRun() {
  const { bridge, status, loaded, shellProps } = usePhaserShell<{
    type: "boost";
  }>("rocket-run");

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (status !== "playing" || !BOOST_KEYS.has(event.key) || event.repeat) {
      return;
    }
    // Space on a focused button presses that button instead.
    if (
      event.key === " " &&
      (event.target as HTMLElement).closest?.("button")
    ) {
      return;
    }
    event.preventDefault();
    bridge.send({ type: "boost" });
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <GameShell
      {...shellProps}
      overTitle="Crash!"
      overMessage={
        <p>You scored {shellProps.score.toLocaleString("en-US")} points.</p>
      }
      howToPlay={
        <ul>
          <li>
            Tap the screen, or press <kbd>Space</kbd>, <kbd>↑</kbd> or{" "}
            <kbd>W</kbd>, to fire your boosters and fly up.
          </li>
          <li>Let go and gravity pulls your rocket down.</li>
          <li>
            Dodge the asteroids! The further you fly, the faster they come.
          </li>
        </ul>
      }
    >
      <Stage
        aspect="3 / 2"
        loaded={loaded}
        poster={<span className="animate-float inline-block">🚀</span>}
      >
        <PhaserGame
          load={load}
          bridge={bridge}
          label="Rocket Run game. Tap or press Space to boost."
          className="size-full"
        />
      </Stage>
    </GameShell>
  );
}
