/**
 * Every tuning number for Astro Hop, in one place. Distances are in art
 * pixels (a tile is 16), speeds in art pixels per second.
 */

export const TILE = 16;
/** Rows in every level (the screen is exactly this tall). */
export const ROWS = 15;
/** What the camera shows, in art pixels. */
export const VIEW_W = 360;
export const VIEW_H = ROWS * TILE;

/** The rules run at a fixed 60 steps per second. */
export const STEP = 1 / 60;

export const PHYS = {
  /** Top speed walking and holding Run. */
  walk: 90,
  run: 150,
  accel: 360,
  airAccel: 280,
  /** Slowing down with no direction held. */
  friction: 480,
  airFriction: 120,
  /** Turning around on the ground. */
  skid: 900,
  /** Jump speed, plus a bit for every unit of running speed. */
  jump: 270,
  jumpRunBonus: 0.15,
  /** Gravity while rising with Jump held (a long, floaty jump)... */
  gravityHold: 600,
  /** ...and the rest of the time. */
  gravity: 1500,
  maxFall: 320,
  /** A jump still works this long after running off a ledge. */
  coyote: 0.09,
  /** A jump pressed this long before landing still happens. */
  jumpBuffer: 0.12,
  /** Bounce off a stomped enemy, higher with Jump held. */
  stompBounce: 210,
  stompBounceHeld: 300,
  /** Bumping a block's corner by this little slides past it instead. */
  cornerNudge: 5,
} as const;

export const KIT = {
  small: { w: 10, h: 14 },
  big: { w: 12, h: 26 },
  /** Flashing time after a hit. */
  invulnerable: 2,
  /** The world pauses this long while Kit grows or shrinks. */
  transform: 0.6,
  lives: 3,
} as const;

export const ENEMY = {
  speed: 30,
  /** Enemies wake up when they are this close to the right edge of the screen. */
  wakeMargin: 32,
  /** Squashed enemies stay on screen this long. */
  squashed: 0.5,
  flipJump: 180,
  /** Boing the frog: waits, then hops. */
  hopWait: 1.3,
  hopJump: 230,
  hopSpeed: 45,
} as const;

export const SHELL = {
  speed: 190,
  /** A still shell wakes back up after this long. */
  wake: 6,
  /** A just-kicked shell can't hurt Kit for this long. */
  grace: 0.25,
} as const;

export const SPARK = {
  speed: 190,
  bounce: 150,
  gravity: 900,
  max: 2,
} as const;

export const ITEM = {
  rise: 16,
  riseSpeed: 28,
  seedSpeed: 50,
  lifeSpeed: 60,
} as const;

export const MOVER = {
  /** Moving platforms travel this many tiles and back. */
  range: 4,
  period: 4.5,
  thickness: 8,
} as const;

export const TIMER = {
  /** Seconds per tick of the level clock. */
  unit: 0.5,
  hurry: 100,
} as const;

export const FLOW = {
  intro: 2.2,
  dying: 2.8,
  /** Kit slides down the beacon pole at this speed. */
  slide: 140,
  walkToRocket: 60,
  clear: 1.2,
} as const;

/** The beacon pole is this many tiles tall above its base block. */
export const POLE_TILES = 9;
/** The rocket waits this many tiles after the pole. */
export const ROCKET_OFFSET = 5;

export const POINTS = {
  coin: 200,
  brick: 50,
  powerUp: 1000,
  kick: 400,
  spark: 100,
  timeTick: 50,
  /** Stomps without landing in between: 100, 200, 400… then an extra life. */
  chain: [100, 200, 400, 800, 1000, 2000, 4000, 8000],
  shellChain: [500, 800, 1000, 2000, 4000, 8000],
  /** Beacon pole: [share of the pole's height, points], highest first. */
  pole: [
    [0.85, 5000],
    [0.6, 2000],
    [0.35, 800],
    [0.1, 400],
    [0, 100],
  ] as [number, number][],
  coinsForLife: 100,
  /** Big Clank: beating it, and pressing the power switch. */
  boss: 5000,
  bossHit: 1000,
  switch: 2000,
} as const;

/** Fortress fire bars: a chain of plasma orbs spinning round a block. */
export const FIREBAR = {
  orbs: 5,
  /** Distance between orb centres. */
  spacing: 8,
  /** Each orb's hit box (smaller than it looks, to be kind). */
  size: 6,
  /** Seconds per full turn (levels can make it faster). */
  period: 4.4,
} as const;

/** Lava blips: hop out of the lava, fall back in, wait, repeat. */
export const BLIP = {
  wait: 1.8,
  jump: 280,
  gravity: 600,
  size: 10,
} as const;

/** Big Clank, the fortress boss. */
export const BOSS = {
  w: 24,
  h: 28,
  /** Health; a stomp takes `stomp`, a spark `spark` (3 stomps or 5 sparks). */
  hp: 15,
  stomp: 5,
  spark: 3,
  speed: 22,
  /** Paces this far either side of where it starts. */
  range: 40,
  hopEvery: 2.6,
  hopJump: 240,
  gravity: 900,
  /** Harmless and flashing this long after a stomp. */
  hurt: 1.2,
  knockback: 14,
  boltEvery: 3.2,
  /** Only throws when Kit is within this many art pixels. */
  boltRange: 140,
  boltSpeed: 70,
  boltBounce: 150,
  boltGravity: 600,
  boltLife: 2.6,
  boltSize: 8,
  /** Powered down, it floats up and away this fast. */
  float: 50,
} as const;
