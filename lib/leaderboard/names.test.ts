import { describe, expect, it } from "vitest";
import { seeded } from "@/lib/games/rng";
import {
  ADJECTIVES,
  buildName,
  CREATURES,
  isValidName,
  NUMBER_MAX,
  parseName,
  randomName,
  randomParts,
} from "./names";

describe("name lists", () => {
  it("have no duplicates and only plain capitalised words", () => {
    for (const list of [ADJECTIVES, CREATURES]) {
      expect(new Set(list).size).toBe(list.length);
      for (const word of list) expect(word).toMatch(/^[A-Z][a-z]+$/);
    }
  });

  it("give plenty of different names", () => {
    expect(ADJECTIVES.length * CREATURES.length * NUMBER_MAX).toBeGreaterThan(
      100_000,
    );
  });
});

describe("names", () => {
  it("round-trip through parseName", () => {
    const rng = seeded(7);
    for (let i = 0; i < 500; i++) {
      const parts = randomParts(rng);
      expect(parseName(buildName(parts))).toEqual(parts);
    }
  });

  it("random names are always valid", () => {
    const rng = seeded(1);
    for (let i = 0; i < 500; i++)
      expect(isValidName(randomName(rng))).toBe(true);
  });

  it("reject anything not built from the lists", () => {
    for (const bad of [
      "",
      "Cosmic Fox",
      "Cosmic Fox 0",
      "Cosmic Fox 100",
      "Cosmic Fox 07",
      "cosmic fox 42",
      "Cosmic  Fox 42",
      " Cosmic Fox 42",
      "Cosmic Fox 42 ",
      "Rude Fox 42",
      "Cosmic Name 42",
      "Cosmic Fox 4\n2",
      42,
      null,
      undefined,
      { name: "Cosmic Fox 42" },
    ]) {
      expect(parseName(bad)).toBeNull();
    }
    expect(isValidName("Cosmic Fox 42")).toBe(true);
    expect(isValidName("Zippy Turtle 99")).toBe(true);
  });
});
