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
    // canvas right away instead of waiting for Phaser's own resize polling
    // (pseudo-fullscreen on iPhone fires no window resize at all).
    const observer = new ResizeObserver(() => {
      if (game?.scale.getParentBounds()) game.scale.refresh();
    });
    if (parent) observer.observe(parent);

    // Phaser remembers where the canvas is on the page; if the page layout
    // shifted since, re-measure before it handles the tap.
    const remeasure = () => game?.scale.updateBounds();
    parent?.addEventListener("pointerdown", remeasure, { capture: true });

    return () => {
      cancelled = true;
      observer.disconnect();
      parent?.removeEventListener("pointerdown", remeasure, { capture: true });
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
