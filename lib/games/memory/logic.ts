/** Pure Memory Match rules: 16 cards, 8 pairs of space symbols. */

import { shuffle, type Rng } from "../rng";

export const SYMBOLS = [
  { icon: "🪐", name: "Ringed planet" },
  { icon: "🌍", name: "Earth" },
  { icon: "🌙", name: "Moon" },
  { icon: "☀️", name: "Sun" },
  { icon: "⭐", name: "Star" },
  { icon: "☄️", name: "Comet" },
  { icon: "🚀", name: "Rocket" },
  { icon: "🛸", name: "Flying saucer" },
] as const;

export type Card = { symbol: number; faceUp: boolean; matched: boolean };

export type Memory = {
  cards: Card[];
  /** Face-up cards waiting to be compared (0, 1 or 2 indices). */
  open: number[];
  /** One move = one pair of cards turned over. */
  moves: number;
  pairs: number;
};

export const PAIRS = SYMBOLS.length;

export function newGame(rng: Rng = Math.random): Memory {
  const symbols = shuffle(
    SYMBOLS.flatMap((_, i) => [i, i]),
    rng,
  );
  return {
    cards: symbols.map((symbol) => ({ symbol, faceUp: false, matched: false })),
    open: [],
    moves: 0,
    pairs: 0,
  };
}

/** True while two unmatched cards are showing and must be turned back. */
export const isMismatch = (game: Memory) => game.open.length === 2;

/** Turns two mismatched cards face down again. */
export function hideMismatch(game: Memory): Memory {
  if (!isMismatch(game)) return game;
  const cards = game.cards.map((card, i) =>
    game.open.includes(i) ? { ...card, faceUp: false } : card,
  );
  return { ...game, cards, open: [] };
}

export function flip(game: Memory, index: number): Memory {
  const card = game.cards[index];
  if (!card || card.faceUp || card.matched) return game;
  // Tapping a third card hides a showing mismatch first.
  const current = isMismatch(game) ? hideMismatch(game) : game;

  const cards = [...current.cards];
  cards[index] = { ...card, faceUp: true };
  const open = [...current.open, index];

  if (open.length < 2) return { ...current, cards, open };

  const [a, b] = open;
  const moves = current.moves + 1;
  if (cards[a].symbol === cards[b].symbol) {
    cards[a] = { ...cards[a], matched: true };
    cards[b] = { ...cards[b], matched: true };
    return { cards, open: [], moves, pairs: current.pairs + 1 };
  }
  return { ...current, cards, open, moves };
}

export const isComplete = (game: Memory) => game.pairs === PAIRS;
