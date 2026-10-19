"use client";

import { useEffect, useEffectEvent } from "react";
import GameShell from "@/components/GameShell";
import PhaserGame from "@/components/PhaserGame";
import Stage from "../shared/Stage";
import { SECTORS } from "@/lib/games/rocket-run/logic";
import { usePhaserShell } from "../shared/usePhaserShell";
import type { RocketState } from "./scenes";

// Phaser is only downloaded when this import runs (first Start).
const load = () => import("./createGame").then((m) => m.createGame);

const BOOST_KEYS = new Set([" ", "ArrowUp", "w", "W"]);

const TOUCH = { actions: [{ id: "boost", label: "Boost", icon: "🔥" }] };

const titleCase = (name: string) =>
  name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function RocketRun() {
  const { bridge, state, status, loaded, shellProps } = usePhaserShell<
    { type: "boost" },
    RocketState
  >("rocket-run");
  const sector = status === "ready" ? 0 : (state?.sector ?? 0);

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
      stats={[{ label: "Sector", value: sector + 1 }]}
      aspect={3 / 2}
      maxWidth="42rem"
      landscape
      touch={TOUCH}
      onAction={(_id, pressed) => {
        if (pressed && status === "playing") bridge.send({ type: "boost" });
      }}
      overTitle="Crash!"
      overMessage={
        <p>
          You scored {shellProps.score.toLocaleString("en-US")} points and
          reached sector {sector + 1}: {titleCase(SECTORS[sector].name)}.
        </p>
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
          <li>
            Every new sector brings something new: wobbly rocks, rock gates,
            speedy comets (watch for the ⚠️ sign) and rock walls with a gap.
          </li>
        </ul>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status === "playing" && sector > 0
          ? `Sector ${sector + 1}: ${titleCase(SECTORS[sector].name)}!`
          : ""}
      </p>
      <Stage
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
