"use client";

import { useEffect, useState } from "react";
import type { GameStatus } from "@/components/GameShell";
import { useReducedMotion, useSound } from "@/components/hooks";
import { getGame, type GameSlug } from "@/lib/games/registry";
import { readBest, recordBest } from "@/lib/storage";
import { GameBridge, type BaseCommand } from "./bridge";
import { sfx } from "./sfx";

/**
 * State shared by the Phaser game pages: GameShell status, score and best,
 * the React <-> scene bridge, and whether Phaser should be loaded yet (only
 * after the first Start, so the page itself stays light).
 */
export function usePhaserShell<Extra extends { type: string } = never>(
  slug: GameSlug,
) {
  const info = getGame(slug)!;
  const [bridge] = useState(() => new GameBridge<BaseCommand | Extra>());
  const [status, setStatus] = useState<GameStatus>("ready");
  const [score, setScore] = useState(0);
  const [bestAtStart, setBestAtStart] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sound] = useSound();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    bridge.configure({ sound, reducedMotion });
  }, [bridge, sound, reducedMotion]);

  useEffect(() => {
    bridge.report({
      onScore: setScore,
      onOver: (final) => {
        setScore(final);
        recordBest(info.slug, final, info.best.direction);
        setStatus("over");
      },
    });
  }, [bridge, info]);

  const start = () => {
    setBestAtStart(readBest(info.slug));
    setScore(0);
    setLoaded(true);
    setStatus("playing");
    if (sound) sfx.start();
    bridge.send({ type: "start" });
  };

  const isNewBest =
    status === "over" &&
    score > 0 &&
    (bestAtStart === null || score > bestAtStart);

  return {
    info,
    bridge,
    status,
    loaded,
    shellProps: {
      game: info,
      status,
      score,
      isNewBest,
      hasSound: true,
      onStart: start,
      onRestart: start,
      onPause: () => {
        setStatus("paused");
        bridge.send({ type: "pause" });
      },
      onResume: () => {
        setStatus("playing");
        bridge.send({ type: "resume" });
      },
    },
  };
}
