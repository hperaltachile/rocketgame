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

    const parent = parentRef.current;
    load().then((createGame) => {
      if (cancelled || !parent) return;
      game = createGame(parent, bridge);
    });

    // Fullscreen, rotation and window resizes change the box: re-fit the
    // canvas right away instead of waiting for Phaser's own resize polling.
    const observer = new ResizeObserver(() => game?.scale.refresh());
    if (parent) observer.observe(parent);

    return () => {
      cancelled = true;
      observer.disconnect();
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
