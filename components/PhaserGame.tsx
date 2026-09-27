"use client";

import { useEffect, useRef } from "react";
// Type-only import: Phaser itself is loaded by `load`, never by this module.
import type Phaser from "phaser";

export type CreateGame<Bridge> = (
  parent: HTMLElement,
  bridge: Bridge,
) => Phaser.Game;

type Props<Bridge> = {
  /**
   * Dynamically imports the module that builds the game, e.g.
   * `() => import("@/games/rocket-run/createGame").then((m) => m.createGame)`.
   * Define it at module scope so it stays stable between renders.
   */
  load: () => Promise<CreateGame<Bridge>>;
  /**
   * Channel between React and the game scenes (callbacks, commands).
   * Read once when the game is created, so keep it stable (e.g. `useState(() => ...)`).
   */
  bridge: Bridge;
  label: string;
  className?: string;
};

/** Creates a Phaser.Game on mount and destroys it (loops, input, audio) on unmount. */
export default function PhaserGame<Bridge>({
  load,
  bridge,
  label,
  className,
}: Props<Bridge>) {
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: Phaser.Game | undefined;
    let cancelled = false;

    load().then((createGame) => {
      if (cancelled || !parentRef.current) return;
      game = createGame(parentRef.current, bridge);
    });

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, [load, bridge]);

  return (
    <div
      ref={parentRef}
      role="application"
      aria-label={label}
      className={className}
    />
  );
}
