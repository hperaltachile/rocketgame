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
 * One entry per game, each a separate chunk loaded only on its own page.
 * Phaser games use `ssr: false` so Phaser never runs on the server.
 */
const GAME_COMPONENTS: Record<GameSlug, ComponentType> = {
  "rocket-run": dynamic(() => import("@/games/rocket-run/RocketRun"), {
    ssr: false,
    loading: GameLoading,
  }),
  "comet-kick": dynamic(() => import("@/games/comet-kick/CometKick"), {
    ssr: false,
    loading: GameLoading,
  }),
  snake: dynamic(() => import("@/games/snake/SnakeGame"), {
    ssr: false,
    loading: GameLoading,
  }),
  minesweeper: dynamic(() => import("@/games/minesweeper/Minesweeper"), {
    loading: GameLoading,
  }),
  tictactoe: dynamic(() => import("@/games/tictactoe/TicTacToe"), {
    loading: GameLoading,
  }),
  memory: dynamic(() => import("@/games/memory/MemoryMatch"), {
    loading: GameLoading,
  }),
  "2048": dynamic(() => import("@/games/2048/Game2048"), {
    loading: GameLoading,
  }),
};

export default function GameLoader({ slug }: { slug: GameSlug }) {
  const Game = GAME_COMPONENTS[slug];
  return <Game />;
}
