/**
 * Star Courier worlds: everything that makes a world look and sound
 * different. **This is the only file to change to add a world.** Copy an
 * entry, give it a new `id` and name, and change the colours, skyline and
 * music. The renderer (games/star-courier/world.ts) and the music player
 * (games/shared/music.ts) read nothing else.
 *
 * Colours are CSS hex strings. Keep the deck darker than the stardust and
 * obstacles so they stand out, and test in the game with reduced motion on.
 */

export type SkylineKind = "domes" | "mesas" | "spires" | "rings";

export type World = {
  id: string;
  name: string;
  /** One line for the world picker. */
  blurb: string;
  sky: { top: string; bottom: string };
  /** Distant things fade into this colour, from `near` to `far` metres. */
  fog: { color: string; near: number; far: number };
  /** The Ring Rail itself. */
  deck: { color: string; stripe: string; glow: string; side: string };
  light: { sky: string; ground: string; sun: string };
  /** Buildings beside the track. */
  skyline: {
    kind: SkylineKind;
    colors: string[];
    /** Windows and beacons. */
    lights: string;
    height: [number, number];
  };
  /** A big planet or moon hanging in the sky. */
  planet: { color: string; ring?: string; size: number; x: number; y: number };
  stars: number;
  /** Parked pods and freighters. */
  vehicles: { pod: string[]; freighter: string; trim: string };
  /** Background music: a looping chiptune made from these settings. */
  music: {
    bpm: number;
    /** Root note in Hz. */
    root: number;
    /** Scale as semitones above the root. */
    scale: number[];
    lead: OscillatorType;
    bass: OscillatorType;
    /** Melody as scale steps (-1 = rest), one per eighth note. */
    melody: number[];
    /** Bass as scale steps, one per quarter note. */
    bassline: number[];
  };
};

export const WORLDS: readonly World[] = [
  {
    id: "moon-base",
    name: "Moon Base",
    blurb: "Grey dunes, glass domes and a big blue planet.",
    sky: { top: "#05081c", bottom: "#27306b" },
    fog: { color: "#1b2150", near: 45, far: 140 },
    deck: {
      color: "#2a2f4a",
      stripe: "#3a4166",
      glow: "#ff9a3c",
      side: "#4b5280",
    },
    light: { sky: "#b8c4ff", ground: "#2b2140", sun: "#fff1d6" },
    skyline: {
      kind: "domes",
      colors: ["#8d93b8", "#6c7299", "#a9b0d6"],
      lights: "#7fe3ff",
      height: [3, 9],
    },
    planet: { color: "#3f7fe0", ring: undefined, size: 30, x: -70, y: 45 },
    stars: 500,
    vehicles: {
      pod: ["#e8edf7", "#ffb547", "#9ad1ff"],
      freighter: "#f05d5e",
      trim: "#2b2f45",
    },
    music: {
      bpm: 132,
      root: 220,
      scale: [0, 2, 4, 7, 9, 12, 14, 16],
      lead: "square",
      bass: "triangle",
      melody: [0, 2, 4, 2, 5, 4, 2, -1, 0, 2, 4, 5, 7, 5, 4, -1],
      bassline: [0, 0, 3, 3, 4, 4, 3, 1],
    },
  },
  {
    id: "mars-canyon",
    name: "Mars Canyon",
    blurb: "Red cliffs, dust and a sunset that never ends.",
    sky: { top: "#2a0b1c", bottom: "#d8643a" },
    fog: { color: "#7a2f2a", near: 40, far: 130 },
    deck: {
      color: "#3b2430",
      stripe: "#56313c",
      glow: "#ffd23f",
      side: "#7a3d3d",
    },
    light: { sky: "#ffc9a3", ground: "#40141a", sun: "#ffe0b0" },
    skyline: {
      kind: "mesas",
      colors: ["#a8452e", "#c45a35", "#873826"],
      lights: "#ffd23f",
      height: [4, 14],
    },
    planet: { color: "#f2c48d", size: 16, x: 60, y: 38 },
    stars: 160,
    vehicles: {
      pod: ["#f3e3c3", "#4cc9f0", "#c9d1d9"],
      freighter: "#7b61ff",
      trim: "#2a1a22",
    },
    music: {
      bpm: 120,
      root: 196,
      scale: [0, 3, 5, 7, 10, 12, 15, 17],
      lead: "sawtooth",
      bass: "square",
      melody: [0, -1, 2, 3, 4, -1, 3, 2, 0, -1, 2, 3, 5, 4, 3, -1],
      bassline: [0, 0, 2, 2, 3, 3, 1, 1],
    },
  },
  {
    id: "ice-moon",
    name: "Ice Moon",
    blurb: "Crystal spires and auroras over a frozen sea.",
    sky: { top: "#03151f", bottom: "#2a7f8f" },
    fog: { color: "#1f5a68", near: 45, far: 140 },
    deck: {
      color: "#1f3442",
      stripe: "#2c4a5c",
      glow: "#7cf5ff",
      side: "#3d6f86",
    },
    light: { sky: "#d6fbff", ground: "#13303d", sun: "#ffffff" },
    skyline: {
      kind: "spires",
      colors: ["#bff3ff", "#8edbf0", "#e6fcff"],
      lights: "#c39bff",
      height: [5, 16],
    },
    planet: { color: "#c39bff", ring: "#f0e0ff", size: 22, x: 65, y: 50 },
    stars: 420,
    vehicles: {
      pod: ["#ffffff", "#ff8fab", "#ffd23f"],
      freighter: "#ff7b39",
      trim: "#1d2b38",
    },
    music: {
      bpm: 116,
      root: 247,
      scale: [0, 2, 3, 7, 8, 12, 14, 15],
      lead: "triangle",
      bass: "sine",
      melody: [4, 3, 2, 0, 2, -1, 3, 4, 5, 4, 3, 2, 0, -1, 1, 2],
      bassline: [0, 0, 4, 4, 3, 3, 1, 1],
    },
  },
  {
    id: "ring-station",
    name: "Ring Station",
    blurb: "A neon space station spinning around a gas giant.",
    sky: { top: "#0d0221", bottom: "#4b1d7a" },
    fog: { color: "#2a1050", near: 40, far: 135 },
    deck: {
      color: "#241a3d",
      stripe: "#35275a",
      glow: "#ff4fd8",
      side: "#5b3d99",
    },
    light: { sky: "#e3c6ff", ground: "#1b0d33", sun: "#ffe9ff" },
    skyline: {
      kind: "rings",
      colors: ["#5d4bd1", "#8a5cf5", "#3dd6d0"],
      lights: "#ff4fd8",
      height: [4, 12],
    },
    planet: { color: "#f29e4c", ring: "#ffd9a8", size: 38, x: -60, y: 40 },
    stars: 600,
    vehicles: {
      pod: ["#3dd6d0", "#ffe066", "#ff8fab"],
      freighter: "#ff5e5b",
      trim: "#160b2b",
    },
    music: {
      bpm: 140,
      root: 233,
      scale: [0, 2, 4, 5, 7, 9, 11, 12],
      lead: "square",
      bass: "sawtooth",
      melody: [0, 4, 7, 4, 5, 4, 2, -1, 0, 4, 7, 6, 7, -1, 4, 2],
      bassline: [0, 0, 5, 5, 3, 3, 4, 4],
    },
  },
];

export function getWorld(id: string | null | undefined): World {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}

/** The world of the day: a different one each day, the same for everyone. */
export function worldOfTheDay(date: Date): World {
  const day = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000,
  );
  return WORLDS[((day % WORLDS.length) + WORLDS.length) % WORLDS.length];
}
