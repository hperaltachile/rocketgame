export type GameSlug =
  "rocket-run" | "snake" | "minesweeper" | "tictactoe" | "memory" | "2048";

export type GameInfo = {
  slug: GameSlug;
  name: string;
  /** One line for cards. */
  tagline: string;
  /** Meta description for the game page. */
  description: string;
  icon: string;
  engine: "phaser" | "react";
  best: {
    label: string;
    /** "high": bigger is better (points). "low": smaller is better (time, moves). */
    direction: "high" | "low";
    unit?: string;
  };
  available: boolean;
};

export const GAMES: readonly GameInfo[] = [
  {
    slug: "rocket-run",
    name: "Rocket Run",
    tagline: "Boost through an endless asteroid field.",
    description:
      "Pilot your rocket through an endless asteroid field. Tap or press Space to boost — how far can you fly?",
    icon: "🚀",
    engine: "phaser",
    best: { label: "Best", direction: "high" },
    available: true,
  },
  {
    slug: "snake",
    name: "Snake",
    tagline: "Eat stars, grow longer, don't bite your tail.",
    description:
      "Classic snake in space: collect stars to grow and speed up. Play with arrow keys, WASD, swipes or the on-screen pad.",
    icon: "🐍",
    engine: "phaser",
    best: { label: "Best", direction: "high" },
    available: true,
  },
  {
    slug: "minesweeper",
    name: "Minesweeper",
    tagline: "Clear the field without hitting a space mine.",
    description:
      "Clear a 9×9 field of hidden space mines. Your first click is always safe — flag the mines and beat your best time.",
    icon: "💣",
    engine: "react",
    best: { label: "Best time", direction: "low", unit: "s" },
    available: true,
  },
  {
    slug: "tictactoe",
    name: "Tic-Tac-Toe",
    tagline: "Outsmart the computer on Easy or Hard.",
    description:
      "Play Tic-Tac-Toe against the computer on Easy or Hard. Can you beat — or at least draw — the unbeatable AI?",
    icon: "⭕",
    engine: "react",
    best: { label: "Wins", direction: "high" },
    available: true,
  },
  {
    slug: "memory",
    name: "Memory Match",
    tagline: "Flip cards and pair up the planets.",
    description:
      "Flip cards to match pairs of planets, stars and comets. Find all eight pairs in as few moves as you can.",
    icon: "🪐",
    engine: "react",
    best: { label: "Fewest moves", direction: "low", unit: " moves" },
    available: true,
  },
  {
    slug: "2048",
    name: "2048",
    tagline: "Slide and merge tiles to reach 2048.",
    description:
      "Slide the tiles and merge matching numbers to reach 2048. Use arrow keys or swipe — how high can you score?",
    icon: "🔢",
    engine: "react",
    best: { label: "Best", direction: "high" },
    available: true,
  },
];

export function getGame(slug: string): GameInfo | undefined {
  return GAMES.find((game) => game.slug === slug);
}

export function formatBest(game: GameInfo, value: number): string {
  return `${value.toLocaleString("en-US")}${game.best.unit ?? ""}`;
}
