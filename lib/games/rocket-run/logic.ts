/**
 * Pure Rocket Run rules: flight physics, the difficulty curve and sectors,
 * obstacle waves, scoring and collisions.
 */

import type { Rng } from "../rng";

export const WORLD = { width: 720, height: 480 } as const;

export const ROCKET = {
  x: 150,
  /** Collision radius; a little smaller than the sprite to feel fair. */
  radius: 13,
} as const;

export const FLIGHT = {
  gravity: 900, // px/s²
  boostVelocity: -330, // px/s, set on each boost
  maxFallSpeed: 460, // px/s
} as const;

export type Flight = { y: number; vy: number };

/** Advances the rocket by `dt` seconds. A boost sets an upward kick first. */
export function stepRocket(flight: Flight, dt: number, boost: boolean): Flight {
  let vy = boost ? FLIGHT.boostVelocity : flight.vy;
  vy = Math.min(vy + FLIGHT.gravity * dt, FLIGHT.maxFallSpeed);
  let y = flight.y + vy * dt;
  const top = ROCKET.radius;
  const bottom = WORLD.height - ROCKET.radius;
  if (y < top) {
    y = top;
    vy = Math.max(vy, 0);
  } else if (y > bottom) {
    y = bottom;
    vy = Math.min(vy, 0);
  }
  return { y, vy };
}

/**
 * Speed and spawn rate ease toward their limits (an exponential approach):
 * quick to notice early on, then gentler, and never past the caps. There
 * are no sudden jumps; sectors add new kinds of obstacles instead.
 */
export const DIFFICULTY = {
  startSpeed: 220, // px/s
  maxSpeed: 520,
  /** Seconds for speed to cover ~63% of the way to the cap. */
  speedRamp: 45,
  startSpawnEvery: 1.3, // s between waves
  minSpawnEvery: 0.62,
  spawnRamp: 55,
} as const;

/** Scroll speed and time between obstacle waves after `elapsed` seconds. */
export function difficulty(elapsed: number): {
  speed: number;
  spawnEvery: number;
} {
  const t = Math.max(0, elapsed);
  const d = DIFFICULTY;
  return {
    speed:
      d.startSpeed +
      (d.maxSpeed - d.startSpeed) * (1 - Math.exp(-t / d.speedRamp)),
    spawnEvery:
      d.startSpawnEvery -
      (d.startSpawnEvery - d.minSpawnEvery) * (1 - Math.exp(-t / d.spawnRamp)),
  };
}

export type Pattern = "rock" | "drifter" | "pair" | "comet" | "wall";

export type Sector = {
  name: string;
  /** Seconds into the run when this sector starts. */
  at: number;
  /** How often each obstacle pattern is picked (relative weights). */
  mix: Partial<Record<Pattern, number>>;
};

/** Each sector adds a new kind of obstacle. The last one lasts forever. */
export const SECTORS: readonly Sector[] = [
  { name: "LAUNCH PAD", at: 0, mix: { rock: 1 } },
  { name: "ROCK BELT", at: 20, mix: { rock: 3, drifter: 1 } },
  { name: "TWIN ROCKS", at: 42, mix: { rock: 3, drifter: 2, pair: 1 } },
  {
    name: "COMET ALLEY",
    at: 66,
    mix: { rock: 2, drifter: 2, pair: 2, comet: 1 },
  },
  {
    name: "ROCK WALLS",
    at: 92,
    mix: { rock: 2, drifter: 2, pair: 2, comet: 2, wall: 1 },
  },
  {
    name: "DEEP SPACE",
    at: 120,
    mix: { rock: 1, drifter: 3, pair: 2, comet: 3, wall: 2 },
  },
];

/** Index into SECTORS for a run time. */
export function sectorAt(elapsed: number): number {
  let index = 0;
  SECTORS.forEach((sector, i) => {
    if (elapsed >= sector.at) index = i;
  });
  return index;
}

/** Quiet seconds after entering a new sector, while its banner shows. */
export const BREATHER = 1.6;

/**
 * Smallest open gap a wave can leave (px): about 5 rockets tall, so there's
 * always a way through. Walls start roomier and narrow toward this.
 */
export const MIN_GAP = 140;
export const WALL_GAP = { first: 200, min: 150, shrinkPerSecond: 0.6 };

export type Obstacle = {
  kind: "rock" | "comet";
  /** Extra distance to the right of the spawn line (comets come from further away). */
  dx: number;
  y: number;
  radius: number;
  /** Multiplier on the scroll speed. */
  speedFactor: number;
  /** Degrees per second. */
  spin: number;
  /** Up-and-down wobble, if any. */
  drift: { amp: number; freq: number; phase: number } | null;
};

const H = WORLD.height;

/** One rock anywhere on screen (the original asteroid). */
export function spawnAsteroid(rng: Rng = Math.random): Obstacle {
  const radius = 16 + Math.floor(rng() * 22); // 16–37
  return {
    kind: "rock",
    dx: 0,
    radius,
    y: radius + rng() * (H - 2 * radius),
    speedFactor: 0.85 + rng() * 0.4,
    spin: (rng() - 0.5) * 160,
    drift: null,
  };
}

function rock(y: number, radius: number, rng: Rng, speedFactor = 1): Obstacle {
  return {
    kind: "rock",
    dx: 0,
    y,
    radius,
    speedFactor,
    spin: (rng() - 0.5) * 160,
    drift: null,
  };
}

/** Where the rocket can see a comet coming: seconds of warning before it enters. */
export const COMET_WARNING = 0.9;

/** The obstacles of one wave for the current sector and speed. */
export function spawnWave(
  sector: number,
  elapsed: number,
  speed: number,
  rng: Rng = Math.random,
): { pattern: Pattern; obstacles: Obstacle[] } {
  const mix = SECTORS[Math.min(sector, SECTORS.length - 1)].mix;
  const entries = Object.entries(mix) as [Pattern, number][];
  let roll = rng() * entries.reduce((sum, [, w]) => sum + w, 0);
  let pattern: Pattern = entries[0][0];
  for (const [name, weight] of entries) {
    roll -= weight;
    if (roll < 0) {
      pattern = name;
      break;
    }
  }

  switch (pattern) {
    case "rock":
      return { pattern, obstacles: [spawnAsteroid(rng)] };

    case "drifter": {
      const radius = 18 + Math.floor(rng() * 13); // 18–30
      const amp = 40 + rng() * 60;
      const lo = radius + amp;
      const o = rock(
        lo + rng() * (H - 2 * lo),
        radius,
        rng,
        0.9 + rng() * 0.25,
      );
      o.drift = { amp, freq: 1.2 + rng() * 1.2, phase: rng() * Math.PI * 2 };
      return { pattern, obstacles: [o] };
    }

    case "pair": {
      // A gate: one rock above the gap and one below.
      const gap = MIN_GAP + 40 + rng() * 60;
      const top = 30 + rng() * (H - 60 - gap);
      const r1 = 22 + Math.floor(rng() * 10);
      const r2 = 22 + Math.floor(rng() * 10);
      return {
        pattern,
        obstacles: [rock(top - r1, r1, rng), rock(top + gap + r2, r2, rng)],
      };
    }

    case "comet": {
      const radius = 11;
      const factor = 1.7 + rng() * 0.3;
      const o: Obstacle = {
        kind: "comet",
        dx: speed * factor * COMET_WARNING,
        y: radius + 20 + rng() * (H - 2 * radius - 40),
        radius,
        speedFactor: factor,
        spin: 0,
        drift: null,
      };
      return { pattern, obstacles: [o] };
    }

    case "wall": {
      const since = Math.max(0, elapsed - WALLS_FROM);
      const gap = Math.max(
        WALL_GAP.min,
        WALL_GAP.first - since * WALL_GAP.shrinkPerSecond,
      );
      const gapTop = 20 + rng() * (H - 40 - gap);
      const obstacles: Obstacle[] = [];
      const radius = 20;
      // Stack rocks above and below the gap, edge to edge.
      for (let y = gapTop - radius; y + radius > 0; y -= radius * 2) {
        obstacles.push(rock(y, radius, rng));
      }
      for (let y = gapTop + gap + radius; y - radius < H; y += radius * 2) {
        obstacles.push(rock(y, radius, rng));
      }
      return { pattern, obstacles };
    }
  }
}

/** When walls first appear. */
const WALLS_FROM = SECTORS.find((sector) => sector.mix.wall)?.at ?? 0;

/** A wall needs room behind it, so the next wave waits at least this long. */
export const AFTER_WALL = 1.3;

/** Vertical position of an obstacle `age` seconds after it spawned. */
export function obstacleY(o: Obstacle, age: number): number {
  if (!o.drift) return o.y;
  return o.y + o.drift.amp * Math.sin(o.drift.phase + o.drift.freq * age);
}

/** An obstacle on screen. */
export type Live = Obstacle & {
  id: number;
  pattern: Pattern;
  x: number;
  /** Seconds since it spawned (drives the wobble). */
  age: number;
};

export type Run = {
  flight: Flight;
  elapsed: number;
  distance: number;
  sector: number;
  spawnTimer: number;
  obstacles: Live[];
  nextId: number;
};

/** Obstacles appear just off the right edge (plus any `dx`). */
export const SPAWN_X = WORLD.width + 60;

export function newRun(): Run {
  return {
    flight: { y: WORLD.height / 2, vy: 0 },
    elapsed: 0,
    distance: 0,
    sector: 0,
    spawnTimer: 0.8,
    obstacles: [],
    nextId: 1,
  };
}

/**
 * Advances a run by `dt` seconds (mutating it): flies the rocket, moves,
 * spawns and removes obstacles, and checks for a crash. The scene draws the
 * result; tests fly it with an autopilot.
 */
export function stepRun(
  run: Run,
  dt: number,
  boost: boolean,
  rng: Rng = Math.random,
): { newSector: boolean; spawned: Live[]; crashed: Live | null } {
  run.elapsed += dt;
  const { speed, spawnEvery } = difficulty(run.elapsed);
  run.flight = stepRocket(run.flight, dt, boost);
  run.distance += speed * dt;

  const sector = sectorAt(run.elapsed);
  const newSector = sector !== run.sector;
  if (newSector) {
    run.sector = sector;
    run.spawnTimer = Math.max(run.spawnTimer, BREATHER);
  }

  const spawned: Live[] = [];
  run.spawnTimer -= dt;
  if (run.spawnTimer <= 0) {
    const wave = spawnWave(run.sector, run.elapsed, speed, rng);
    for (const o of wave.obstacles) {
      const live = {
        ...o,
        id: run.nextId++,
        pattern: wave.pattern,
        x: SPAWN_X + o.dx,
        age: 0,
      };
      run.obstacles.push(live);
      spawned.push(live);
    }
    run.spawnTimer =
      wave.pattern === "wall" ? Math.max(spawnEvery, AFTER_WALL) : spawnEvery;
  }

  let crashed: Live | null = null;
  const rocket = { x: ROCKET.x, y: run.flight.y, radius: ROCKET.radius };
  for (const o of run.obstacles) {
    o.x -= speed * o.speedFactor * dt;
    o.age += dt;
    if (
      !crashed &&
      collides(rocket, { x: o.x, y: obstacleY(o, o.age), radius: o.radius })
    ) {
      crashed = o;
    }
  }
  run.obstacles = run.obstacles.filter((o) => o.x > -80);
  return { newSector, spawned, crashed };
}

/** One point per 25 px flown. */
export const PX_PER_POINT = 25;

export function scoreFor(distance: number): number {
  return Math.max(0, Math.floor(distance / PX_PER_POINT));
}

export type Circle = { x: number; y: number; radius: number };

/** Circle overlap with a little forgiveness so near misses don't count. */
export function collides(a: Circle, b: Circle, forgiveness = 0.85): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const reach = (a.radius + b.radius) * forgiveness;
  return dx * dx + dy * dy < reach * reach;
}
