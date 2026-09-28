import { describe, expect, it } from "vitest";
import { seeded } from "../rng";
import {
  flip,
  hideMismatch,
  isComplete,
  isMismatch,
  newGame,
  PAIRS,
  type Memory,
} from "./logic";

/** Indices of the two cards showing `symbol`. */
const pairOf = (game: Memory, symbol: number) =>
  game.cards.flatMap((c, i) => (c.symbol === symbol ? [i] : []));

/** First card whose symbol differs from card `index`. */
const differentFrom = (game: Memory, index: number) =>
  game.cards.findIndex((c) => c.symbol !== game.cards[index].symbol);

describe("deck", () => {
  it("has 16 face-down cards: 8 pairs", () => {
    const game = newGame(seeded(1));
    expect(game.cards).toHaveLength(16);
    for (let s = 0; s < PAIRS; s++) expect(pairOf(game, s)).toHaveLength(2);
    expect(game.cards.every((c) => !c.faceUp && !c.matched)).toBe(true);
  });

  it("is shuffled (and reproducible with a seed)", () => {
    const a = newGame(seeded(1)).cards.map((c) => c.symbol);
    const b = newGame(seeded(1)).cards.map((c) => c.symbol);
    const c = newGame(seeded(2)).cards.map((c) => c.symbol);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe("flipping", () => {
  it("a matching pair stays up and counts one move", () => {
    let game = newGame(seeded(3));
    const [a, b] = pairOf(game, 0);
    game = flip(game, a);
    expect(game.moves).toBe(0);
    game = flip(game, b);
    expect(game.moves).toBe(1);
    expect(game.pairs).toBe(1);
    expect(game.cards[a].matched && game.cards[b].matched).toBe(true);
    expect(game.open).toEqual([]);
  });

  it("a mismatch shows both cards until hidden", () => {
    let game = newGame(seeded(3));
    game = flip(flip(game, 0), differentFrom(game, 0));
    expect(isMismatch(game)).toBe(true);
    expect(game.moves).toBe(1);
    game = hideMismatch(game);
    expect(game.cards.every((c) => !c.faceUp)).toBe(true);
    expect(game.open).toEqual([]);
  });

  it("tapping a third card hides the mismatch and opens the new card", () => {
    let game = newGame(seeded(4));
    const second = differentFrom(game, 0);
    game = flip(flip(game, 0), second);
    const third = game.cards.findIndex((_, i) => i !== 0 && i !== second);
    game = flip(game, third);
    expect(game.open).toEqual([third]);
    expect(game.cards[0].faceUp).toBe(false);
    expect(game.cards[third].faceUp).toBe(true);
  });

  it("ignores the same card twice and matched cards", () => {
    let game = newGame(seeded(5));
    game = flip(game, 0);
    expect(flip(game, 0)).toBe(game);
    const [a, b] = pairOf(newGame(seeded(5)), 1);
    let matched = flip(flip(newGame(seeded(5)), a), b);
    expect(flip(matched, a)).toBe(matched);
    matched = flip(matched, a);
    expect(matched.moves).toBe(1);
  });

  it("finishes after all 8 pairs, with 8 moves for a perfect game", () => {
    let game = newGame(seeded(6));
    for (let s = 0; s < PAIRS; s++) {
      const [a, b] = pairOf(game, s);
      game = flip(flip(game, a), b);
    }
    expect(isComplete(game)).toBe(true);
    expect(game.moves).toBe(8);
  });
});
