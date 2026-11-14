"use client";

import { useEffect, useRef } from "react";

/** What a Three.js game module hands back: a way to resize it and to clean up. */
export type ThreeHandle = {
  resize: (width: number, height: number) => void;
  destroy: () => void;
};

export type CreateThreeGame<Bridge> = (
  parent: HTMLElement,
  bridge: Bridge,
) => ThreeHandle;

type Props<Bridge> = {
  /**
   * Dynamically imports the module that builds the game, e.g.
   * `() => import("@/games/star-courier/createGame").then((m) => m.createGame)`.
   * Define it at module scope so it stays stable between renders. Three.js
   * is only downloaded when this runs (after the first Start).
   */
  load: () => Promise<CreateThreeGame<Bridge>>;
  /** Channel between React and the game (keep it stable). */
  bridge: Bridge;
  label: string;
  className?: string;
};

/** Creates a Three.js game on mount, keeps it sized to its box, and destroys it on unmount. */
export default function ThreeGame<Bridge>({
  load,
  bridge,
  label,
  className,
}: Props<Bridge>) {
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: ThreeHandle | undefined;
    let cancelled = false;
    const parent = parentRef.current;
    if (!parent) return;

    const fit = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (width > 0 && height > 0) game?.resize(width, height);
    };

    load().then((createGame) => {
      if (cancelled) return;
      game = createGame(parent, bridge);
      fit();
    });

    // Fullscreen, rotation and window resizes all change the box; pseudo-
    // fullscreen on iPhone fires no window resize, so watch the box itself.
    const observer = new ResizeObserver(fit);
    observer.observe(parent);

    return () => {
      cancelled = true;
      observer.disconnect();
      game?.destroy();
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
