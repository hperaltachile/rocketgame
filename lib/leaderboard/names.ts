import type { Rng } from "@/lib/games/rng";

/**
 * Leaderboard names are built from these lists only ("Cosmic Fox 42").
 * Players never type text, so no real names or rude words can appear.
 * Every word must be kid-friendly. Only add words; removing or renaming one
 * makes names already on the boards invalid for new saves.
 */
export const ADJECTIVES = [
  "Astro",
  "Blazing",
  "Bouncy",
  "Brave",
  "Bright",
  "Bubbly",
  "Clever",
  "Comet",
  "Cosmic",
  "Cozy",
  "Daring",
  "Dizzy",
  "Electric",
  "Fizzy",
  "Galactic",
  "Glowing",
  "Golden",
  "Happy",
  "Jolly",
  "Lucky",
  "Lunar",
  "Mighty",
  "Neon",
  "Nimble",
  "Orbit",
  "Pixel",
  "Plasma",
  "Quick",
  "Rocket",
  "Shiny",
  "Silly",
  "Solar",
  "Sparkly",
  "Speedy",
  "Starry",
  "Super",
  "Swift",
  "Turbo",
  "Wobbly",
  "Zippy",
] as const;

export const CREATURES = [
  "Alien",
  "Asteroid",
  "Badger",
  "Bear",
  "Blob",
  "Bunny",
  "Cat",
  "Comet",
  "Dino",
  "Dragon",
  "Duck",
  "Falcon",
  "Fox",
  "Frog",
  "Gecko",
  "Jelly",
  "Koala",
  "Llama",
  "Meteor",
  "Moon",
  "Narwhal",
  "Nova",
  "Octopus",
  "Otter",
  "Owl",
  "Panda",
  "Penguin",
  "Pilot",
  "Planet",
  "Puffin",
  "Quasar",
  "Racoon",
  "Robot",
  "Rocket",
  "Shark",
  "Sloth",
  "Squid",
  "Star",
  "Tiger",
  "Turtle",
] as const;

export const NUMBER_MIN = 1;
export const NUMBER_MAX = 99;

export type NameParts = { adjective: number; creature: number; number: number };

export function buildName({ adjective, creature, number }: NameParts): string {
  return `${ADJECTIVES[adjective]} ${CREATURES[creature]} ${number}`;
}

export function randomParts(rng: Rng = Math.random): NameParts {
  const pick = (count: number) => Math.floor(rng() * count);
  return {
    adjective: pick(ADJECTIVES.length),
    creature: pick(CREATURES.length),
    number: NUMBER_MIN + pick(NUMBER_MAX - NUMBER_MIN + 1),
  };
}

export const randomName = (rng: Rng = Math.random) =>
  buildName(randomParts(rng));

/** The parts of a name built from the lists, or null for anything else. */
export function parseName(value: unknown): NameParts | null {
  if (typeof value !== "string") return null;
  const match = /^([A-Za-z]+) ([A-Za-z]+) ([1-9][0-9]?)$/.exec(value);
  if (!match) return null;
  const adjective = (ADJECTIVES as readonly string[]).indexOf(match[1]);
  const creature = (CREATURES as readonly string[]).indexOf(match[2]);
  const number = Number(match[3]);
  if (adjective < 0 || creature < 0) return null;
  if (number < NUMBER_MIN || number > NUMBER_MAX) return null;
  return { adjective, creature, number };
}

export const isValidName = (value: unknown) => parseName(value) !== null;
