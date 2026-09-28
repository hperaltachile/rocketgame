"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { GameSlug } from "@/lib/games/registry";

export function GameLoading() {
  return (
    <div
      role="status"
      className="mx-auto flex aspect-square w-full max-w-2xl items-center justify-center rounded-2xl border border-line bg-surface text-muted"
    >
      Loading game…
    </div>
  );
}

/**
 * One entry per built game, each a separate chunk loaded only on its page:
 *   "2048": dynamic(() => import("@/games/2048/Game2048"), { loading: GameLoading }),
 * Phaser games also pass `ssr: false`.
 */
const GAME_COMPONENTS: Partial<Record<GameSlug, ComponentType>> = {
  "rocket-run": dynamic(() => import("@/games/rocket-run/RocketRun"), {
    ssr: false,
    loading: GameLoading,
  }),
  "2048": dynamic(() => import("@/games/2048/Game2048"), {
    loading: GameLoading,
  }),
};

export default function GameLoader({ slug }: { slug: GameSlug }) {
  const Game = GAME_COMPONENTS[slug];
  return Game ? <Game /> : <GameLoading />;
}
