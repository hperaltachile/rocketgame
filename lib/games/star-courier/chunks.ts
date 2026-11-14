/**
 * Hand-designed track pieces ("chunks") and the sectors that unlock them.
 *
 * A chunk is a short stretch of the three lanes. Each row says what sits in
 * each lane at a distance `at` from the chunk's start, written left to right:
 *
 *   .  nothing          c  cargo crate (jump)     g  laser gate (slide)
 *   o  crater (jump)    P  parked pod (go round)  F  freighter (go round)
 *   *  a power-up (or stardust when a power-up came by recently)
 *
 * Every chunk starts and ends with all three lanes open, so chunks chain in
 * any order, and the tests check that every chunk can be passed from every
 * lane (`routeExists`). To add one, append it to CHUNKS and run `npm test`.
 */

export type ObstacleKind = "crate" | "gate" | "gap" | "pod" | "freighter";

/** Size of each obstacle. `top`: you clear it if your feet are higher. */
export const OBSTACLES: Readonly<
  Record<
    ObstacleKind,
    { depth: number; top: number; bottom: number; tall: boolean }
  >
> = {
  crate: { depth: 1.2, top: 1.0, bottom: 0, tall: false },
  /** The beam starts `bottom` above the ground: slide under it. */
  gate: { depth: 0.5, top: 3, bottom: 1.1, tall: false },
  /** A hole in the deck: anything off the ground clears it. */
  gap: { depth: 3, top: 0.01, bottom: 0, tall: false },
  pod: { depth: 8, top: 3.2, bottom: 0, tall: true },
  freighter: { depth: 12, top: 3.2, bottom: 0, tall: true },
};

const CELL_KINDS: Readonly<Record<string, ObstacleKind>> = {
  c: "crate",
  g: "gate",
  o: "gap",
  P: "pod",
  F: "freighter",
};

export type CoinRun = {
  lane: number;
  /** Distance of the first stardust (or the middle one, for an arc). */
  at: number;
  n: number;
  /** An arc over an obstacle: shows where to jump. */
  arc?: boolean;
  /** Low stardust: shows where to slide. */
  low?: boolean;
};

export type Chunk = {
  id: string;
  length: number;
  /** First sector this chunk can appear in. */
  minSector: number;
  /** How often it's picked, relative to the others. */
  weight: number;
  rows: readonly { at: number; lanes: string }[];
  coins: readonly CoinRun[];
};

export type Sector = {
  name: string;
  /** Metres into the run where the sector starts. */
  at: number;
};

/** Each sector unlocks new chunks; a new sector starts with a breather. */
export const SECTORS: readonly Sector[] = [
  { name: "LAUNCH LANE", at: 0 },
  { name: "CRATER ROW", at: 260 },
  { name: "LASER LOOP", at: 620 },
  { name: "POD PARK", at: 1050 },
  { name: "FREIGHTER WAY", at: 1600 },
  { name: "DEEP ORBIT", at: 2300 },
];

export function sectorAt(distance: number): number {
  let index = 0;
  SECTORS.forEach((s, i) => {
    if (distance >= s.at) index = i;
  });
  return index;
}

/** A calm stretch with a line of stardust: used after a new sector starts. */
export const BREATHER: Chunk = {
  id: "breather",
  length: 34,
  minSector: 99,
  weight: 0,
  rows: [],
  coins: [{ lane: 1, at: 6, n: 12 }],
};

export const CHUNKS: readonly Chunk[] = [
  // Sector 0: Launch Lane (crates)
  {
    id: "stardust-lane",
    length: 30,
    minSector: 0,
    weight: 1,
    rows: [{ at: 18, lanes: "*.." }],
    coins: [{ lane: 1, at: 4, n: 10 }],
  },
  {
    id: "one-crate",
    length: 30,
    minSector: 0,
    weight: 3,
    rows: [{ at: 15, lanes: ".c." }],
    coins: [
      { lane: 1, at: 15, n: 5, arc: true },
      { lane: 0, at: 8, n: 6 },
    ],
  },
  {
    id: "crate-pair",
    length: 32,
    minSector: 0,
    weight: 3,
    rows: [
      { at: 13, lanes: "c.c" },
      { at: 24, lanes: ".*." },
    ],
    coins: [{ lane: 1, at: 4, n: 8 }],
  },
  {
    id: "crate-stairs",
    length: 50,
    minSector: 0,
    weight: 2,
    rows: [
      { at: 10, lanes: "c.." },
      { at: 25, lanes: ".c." },
      { at: 40, lanes: "..c" },
    ],
    coins: [
      { lane: 2, at: 6, n: 10 },
      { lane: 2, at: 40, n: 5, arc: true },
    ],
  },
  {
    id: "crate-row",
    length: 32,
    minSector: 0,
    weight: 2,
    rows: [{ at: 16, lanes: "ccc" }],
    coins: [{ lane: 1, at: 16, n: 5, arc: true }],
  },

  // Sector 1: Crater Row (craters, the first pods)
  {
    id: "crater",
    length: 32,
    minSector: 1,
    weight: 3,
    rows: [{ at: 15, lanes: ".o." }],
    coins: [{ lane: 1, at: 16, n: 5, arc: true }],
  },
  {
    id: "crater-sides",
    length: 34,
    minSector: 1,
    weight: 2,
    rows: [
      { at: 14, lanes: "o.o" },
      { at: 26, lanes: "*.." },
    ],
    coins: [{ lane: 1, at: 5, n: 10 }],
  },
  {
    id: "pod-left",
    length: 38,
    minSector: 1,
    weight: 3,
    rows: [{ at: 12, lanes: "P.." }],
    coins: [{ lane: 1, at: 8, n: 8 }],
  },
  {
    id: "pod-pair",
    length: 40,
    minSector: 1,
    weight: 2,
    rows: [{ at: 12, lanes: "P.P" }],
    coins: [{ lane: 1, at: 10, n: 8 }],
  },
  {
    id: "pod-slalom",
    length: 64,
    minSector: 3,
    weight: 2,
    rows: [
      { at: 14, lanes: "PP." },
      { at: 40, lanes: ".PP" },
    ],
    coins: [
      { lane: 2, at: 10, n: 6 },
      { lane: 0, at: 38, n: 6 },
    ],
  },

  // Sector 2: Laser Loop (gates)
  {
    id: "gate",
    length: 30,
    minSector: 2,
    weight: 3,
    rows: [{ at: 15, lanes: ".g." }],
    coins: [{ lane: 1, at: 12, n: 4, low: true }],
  },
  {
    id: "gate-row",
    length: 30,
    minSector: 2,
    weight: 2,
    rows: [{ at: 15, lanes: "ggg" }],
    coins: [{ lane: 0, at: 12, n: 4, low: true }],
  },
  {
    id: "gate-crate",
    length: 46,
    minSector: 2,
    weight: 2,
    rows: [
      { at: 12, lanes: "g.c" },
      { at: 32, lanes: "c.g" },
    ],
    coins: [{ lane: 1, at: 6, n: 14 }],
  },
  {
    id: "jump-then-slide",
    length: 50,
    minSector: 2,
    weight: 2,
    rows: [
      { at: 12, lanes: "ccc" },
      { at: 34, lanes: "ggg" },
    ],
    coins: [
      { lane: 1, at: 12, n: 5, arc: true },
      { lane: 1, at: 31, n: 4, low: true },
    ],
  },

  // Sector 3: Pod Park (pods everywhere, mixed with the rest)
  {
    id: "pod-wall",
    length: 58,
    minSector: 3,
    weight: 3,
    rows: [
      { at: 16, lanes: "PP." },
      { at: 38, lanes: ".gP" },
    ],
    coins: [
      { lane: 2, at: 12, n: 6 },
      { lane: 1, at: 35, n: 4, low: true },
    ],
  },
  {
    id: "pod-tunnel",
    length: 58,
    minSector: 3,
    weight: 3,
    rows: [
      { at: 8, lanes: "P.P" },
      { at: 21, lanes: ".c." },
      { at: 34, lanes: "P.P" },
      { at: 47, lanes: ".g." },
    ],
    coins: [
      { lane: 1, at: 21, n: 5, arc: true },
      { lane: 1, at: 44, n: 4, low: true },
    ],
  },
  {
    id: "zigzag",
    length: 72,
    minSector: 3,
    weight: 2,
    rows: [
      { at: 14, lanes: ".PP" },
      { at: 36, lanes: "P.P" },
      { at: 58, lanes: "PP." },
    ],
    coins: [
      { lane: 0, at: 12, n: 6 },
      { lane: 1, at: 34, n: 6 },
      { lane: 2, at: 56, n: 6 },
    ],
  },

  // Sector 4: Freighter Way (freighters come toward you)
  {
    id: "freighter",
    length: 46,
    minSector: 4,
    weight: 3,
    rows: [{ at: 28, lanes: ".F." }],
    coins: [{ lane: 0, at: 6, n: 12 }],
  },
  {
    id: "freighter-pod",
    length: 56,
    minSector: 4,
    weight: 2,
    rows: [
      { at: 14, lanes: "P.." },
      { at: 36, lanes: "..F" },
    ],
    coins: [{ lane: 1, at: 8, n: 14 }],
  },
  {
    id: "freighter-pair",
    length: 54,
    minSector: 4,
    weight: 2,
    rows: [
      { at: 18, lanes: ".c." },
      { at: 34, lanes: "F.F" },
    ],
    coins: [
      { lane: 1, at: 18, n: 5, arc: true },
      { lane: 1, at: 28, n: 8 },
    ],
  },
  {
    id: "freighter-gates",
    length: 58,
    minSector: 4,
    weight: 2,
    rows: [
      { at: 12, lanes: "g.." },
      { at: 38, lanes: ".F." },
      { at: 44, lanes: "..c" },
    ],
    coins: [
      { lane: 0, at: 9, n: 4, low: true },
      { lane: 0, at: 22, n: 10 },
    ],
  },

  // Sector 5: Deep Orbit (tight mixes)
  {
    id: "rush",
    length: 62,
    minSector: 5,
    weight: 3,
    rows: [
      { at: 10, lanes: "cPg" },
      { at: 30, lanes: "Pg." },
      { at: 46, lanes: ".Fc" },
    ],
    coins: [
      { lane: 2, at: 7, n: 4, low: true },
      { lane: 2, at: 46, n: 5, arc: true },
    ],
  },
  {
    id: "crate-gauntlet",
    length: 60,
    minSector: 5,
    weight: 2,
    rows: [
      { at: 10, lanes: "PcP" },
      { at: 24, lanes: ".g." },
      { at: 38, lanes: "PoP" },
      { at: 50, lanes: "..*" },
    ],
    coins: [
      { lane: 1, at: 10, n: 5, arc: true },
      { lane: 1, at: 21, n: 4, low: true },
      { lane: 1, at: 39, n: 5, arc: true },
    ],
  },
  {
    id: "freighter-zigzag",
    length: 74,
    minSector: 5,
    weight: 2,
    rows: [
      { at: 24, lanes: "F.P" },
      { at: 36, lanes: ".c." },
      { at: 50, lanes: "P.F" },
      { at: 62, lanes: ".g." },
    ],
    coins: [
      { lane: 1, at: 6, n: 12 },
      { lane: 1, at: 36, n: 5, arc: true },
      { lane: 1, at: 59, n: 4, low: true },
    ],
  },
];

export type Cell = { lane: number; at: number; kind: ObstacleKind | "power" };

/** The obstacles and power-up slots of a chunk, one entry per cell. */
export function chunkCells(chunk: Chunk): Cell[] {
  const cells: Cell[] = [];
  for (const row of chunk.rows) {
    for (let lane = 0; lane < 3; lane++) {
      const ch = row.lanes[lane];
      if (ch === "*") cells.push({ lane, at: row.at, kind: "power" });
      else if (CELL_KINDS[ch])
        cells.push({ lane, at: row.at, kind: CELL_KINDS[ch] });
    }
  }
  return cells;
}

/** Positions of a coin run's stardust: distance along the chunk and height. */
export function coinPositions(
  run: CoinRun,
  spacing: number,
): { at: number; y: number }[] {
  const out: { at: number; y: number }[] = [];
  for (let i = 0; i < run.n; i++) {
    if (run.arc) {
      // Centred on `at`, peaking at the top of a jump.
      const t = run.n === 1 ? 0 : (i / (run.n - 1)) * 2 - 1;
      out.push({
        at: run.at + t * ((run.n - 1) / 2) * spacing,
        y: 0.9 + 1.5 * (1 - t * t),
      });
    } else {
      out.push({ at: run.at + i * spacing, y: run.low ? 0.45 : 0.9 });
    }
  }
  return out;
}

/** Room it takes to move one lane over, at top speed. */
export const SWITCH_ROOM = 5;
/** A freighter's lane counts as blocked this far before you meet it. */
export const FREIGHTER_LEAD = 16;

/**
 * Whether a lane is blocked for good (no jump or slide gets you through) at
 * distance `z` in the chunk: pods, and freighters around where you meet them.
 */
export function laneBlocked(chunk: Chunk, lane: number, z: number): boolean {
  for (const cell of chunkCells(chunk)) {
    if (cell.lane !== lane) continue;
    if (cell.kind === "pod") {
      if (z >= cell.at - 1 && z <= cell.at + OBSTACLES.pod.depth + 1)
        return true;
    } else if (cell.kind === "freighter") {
      if (
        z >= cell.at - FREIGHTER_LEAD &&
        z <= cell.at + OBSTACLES.freighter.depth + 1
      )
        return true;
    }
  }
  return false;
}

/**
 * Can a player who enters the chunk in `startLane` get through it? Walks the
 * chunk in half-metre steps; moving one lane over needs SWITCH_ROOM with both
 * lanes open. Crates, craters and gates never block (jump or slide).
 */
export function routeExists(chunk: Chunk, startLane: number): boolean {
  const step = 0.5;
  const steps = Math.ceil(chunk.length / step);
  const k = Math.ceil(SWITCH_ROOM / step);
  const open = (lane: number, i: number) => !laneBlocked(chunk, lane, i * step);
  const reach: boolean[][] = [];
  for (let i = 0; i <= steps; i++) {
    reach.push([0, 1, 2].map((lane) => i === 0 && lane === startLane));
    if (i === 0) continue;
    for (let lane = 0; lane < 3; lane++) {
      if (!open(lane, i)) continue;
      if (reach[i - 1][lane]) {
        reach[i][lane] = true;
        continue;
      }
      if (i < k) continue;
      for (const from of [lane - 1, lane + 1]) {
        if (from < 0 || from > 2 || !reach[i - k][from]) continue;
        let clear = true;
        for (let j = i - k; j <= i && clear; j++)
          clear = open(lane, j) && open(from, j);
        if (clear) reach[i][lane] = true;
      }
    }
  }
  return reach[steps].some(Boolean);
}
