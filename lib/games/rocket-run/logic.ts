/** Pure Rocket Run rules: flight physics, difficulty curve, scoring, collisions. */

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

export const DIFFICULTY = {
  startSpeed: 230, // px/s
  speedPerSecond: 9,
  maxSpeed: 560,
  startSpawnEvery: 1.25, // s between asteroids
  spawnEveryPerSecond: 0.015,
  minSpawnEvery: 0.42,
} as const;

/** Scroll speed and asteroid spawn interval after `elapsed` seconds. */
export function difficulty(elapsed: number): {
  speed: number;
  spawnEvery: number;
} {
  const t = Math.max(0, elapsed);
  return {
    speed: Math.min(
      DIFFICULTY.startSpeed + DIFFICULTY.speedPerSecond * t,
      DIFFICULTY.maxSpeed,
    ),
    spawnEvery: Math.max(
      DIFFICULTY.startSpawnEvery - DIFFICULTY.spawnEveryPerSecond * t,
      DIFFICULTY.minSpawnEvery,
    ),
  };
}

/** One point per 25 px flown. */
export const PX_PER_POINT = 25;

export function scoreFor(distance: number): number {
  return Math.max(0, Math.floor(distance / PX_PER_POINT));
}

export type AsteroidSpec = {
  y: number;
  radius: number;
  /** Multiplier on the scroll speed so asteroids drift at different speeds. */
  speedFactor: number;
  /** Degrees per second. */
  spin: number;
};

export function spawnAsteroid(rng: () => number = Math.random): AsteroidSpec {
  const radius = 16 + Math.floor(rng() * 22); // 16–37
  return {
    radius,
    y: radius + rng() * (WORLD.height - 2 * radius),
    speedFactor: 0.85 + rng() * 0.4,
    spin: (rng() - 0.5) * 160,
  };
}

export type Circle = { x: number; y: number; radius: number };

/** Circle overlap with a little forgiveness so near misses don't count. */
export function collides(a: Circle, b: Circle, forgiveness = 0.85): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const reach = (a.radius + b.radius) * forgiveness;
  return dx * dx + dy * dy < reach * reach;
}
