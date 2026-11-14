/**
 * Pure Star Courier rules: running, lane changes, jumps and slides, the
 * chunk-based track, collisions, stumbles, Gloop, power-ups and scoring.
 * No DOM or Three.js here, so it's all unit-tested; the renderer just draws
 * a `Run` and plays its `events`.
 *
 * Coordinates: `z` is distance along the track (the player runs toward +z),
 * lanes are 0 (left), 1 (middle) and 2 (right), `y` is height above the deck.
 */

import type { Rng } from "../rng";
import {
  BREATHER,
  CHUNKS,
  OBSTACLES,
  chunkCells,
  coinPositions,
  sectorAt,
  type Chunk,
  type ObstacleKind,
} from "./chunks";
import {
  CONFIG,
  POWER_UPS,
  chunkGapAt,
  powerUpTime,
  speedAt,
  type PowerUpKind,
} from "./config";

export type Action = "left" | "right" | "up" | "down";

export type Obstacle = {
  id: number;
  kind: ObstacleKind;
  lane: number;
  /** Near edge; the obstacle runs from z to z + depth. */
  z: number;
  /** Freighters: moving toward the player. */
  awake: boolean;
  /** Already bumped into (or smashed): no more collisions. */
  hit: boolean;
  /** Popped by Warp Dash or a Bubble Shield. */
  smashed: boolean;
  /** Last step's overlap, to tell a side bump from a head-on one. */
  wasAlongside: boolean;
  wasInLane: boolean;
  wasClear: boolean;
};

export type Stardust = {
  id: number;
  lane: number;
  z: number;
  y: number;
  taken: boolean;
};

export type Pickup = {
  id: number;
  kind: PowerUpKind;
  lane: number;
  z: number;
  taken: boolean;
};

export type RunEvent =
  | { type: "jump" | "land" | "slide" | "drop" | "lane" | "boing" }
  | { type: "dust"; streak: number }
  | { type: "power"; kind: PowerUpKind }
  | { type: "powerEnd"; kind: PowerUpKind }
  | { type: "stumble" | "shield" | "smash"; lane: number; z: number }
  | { type: "caught" | "crash" }
  | { type: "sector"; sector: number };

export type RunStats = {
  jumps: number;
  slides: number;
  stardust: number;
  powerUps: number;
  /** Freighters that went past without a bump. */
  freightersDodged: number;
  stumbles: number;
};

export type Player = {
  lane: number;
  /** The lane before the current lane change (a side bump sends you back). */
  prevLane: number;
  /** Where the current lane change started, and how far along it is (0–1). */
  fromX: number;
  laneT: number;
  y: number;
  vy: number;
  /** Seconds of slide left. */
  slide: number;
  /** Slide as soon as you land (pressed down in mid-air). */
  slideOnLanding: boolean;
};

export type RunOptions = {
  /** Permanent multiplier from the courier rank. */
  multiplier?: number;
  /** Shop upgrade level for each power-up. */
  upgrades?: Partial<Record<PowerUpKind, number>>;
};

export type Run = {
  elapsed: number;
  distance: number;
  speed: number;
  /** Exact score; show Math.floor(score). */
  score: number;
  stardust: number;
  baseMultiplier: number;
  upgrades: Partial<Record<PowerUpKind, number>>;
  player: Player;
  obstacles: Obstacle[];
  dust: Stardust[];
  pickups: Pickup[];
  /** Seconds left on each active power-up (0 = off). */
  active: Record<PowerUpKind, number>;
  sector: number;
  /** When the last stumble happened (elapsed seconds). */
  lastStumble: number;
  /** Seconds of "just bumped, no more bumps" left. */
  grace: number;
  /** How far behind Gloop is (metres). */
  gloopGap: number;
  over: null | "caught" | "crash";
  stats: RunStats;
  /** What happened during the last step, for sounds and effects. */
  events: RunEvent[];
  // Track building
  nextChunkAt: number;
  lastChunkId: string;
  spawnSector: number;
  lastPowerAt: number;
  nextId: number;
  // Input buffer
  queue: { action: Action; at: number }[];
  dustStreak: number;
  lastDustAt: number;
};

const PLAYER = CONFIG.player;
/** Half an obstacle's width across its lane. */
const OBSTACLE_HALF_WIDTH = 0.85;

export const laneX = (lane: number) => (lane - 1) * CONFIG.laneWidth;

const easeOut = (t: number) => 1 - (1 - Math.min(1, t)) ** 3;

/** The player's sideways position right now. */
export function playerX(p: Player): number {
  return p.fromX + (laneX(p.lane) - p.fromX) * easeOut(p.laneT);
}

export const isGrounded = (p: Player) => p.y <= 0 && p.vy <= 0;
export const playerHeight = (p: Player) =>
  p.slide > 0 ? PLAYER.slideHeight : PLAYER.height;

export function multiplier(run: Run): number {
  return run.baseMultiplier * (run.active.twin > 0 ? 2 : 1);
}

export function newRun(options: RunOptions = {}): Run {
  return {
    elapsed: 0,
    distance: 0,
    speed: speedAt(0),
    score: 0,
    stardust: 0,
    baseMultiplier: Math.max(1, Math.floor(options.multiplier ?? 1)),
    upgrades: options.upgrades ?? {},
    player: {
      lane: 1,
      prevLane: 1,
      fromX: 0,
      laneT: 1,
      y: 0,
      vy: 0,
      slide: 0,
      slideOnLanding: false,
    },
    obstacles: [],
    dust: [],
    pickups: [],
    active: { warp: 0, magnet: 0, boots: 0, twin: 0, shield: 0 },
    sector: 0,
    lastStumble: -Infinity,
    grace: 0,
    gloopGap: CONFIG.gloop.near,
    over: null,
    stats: {
      jumps: 0,
      slides: 0,
      stardust: 0,
      powerUps: 0,
      freightersDodged: 0,
      stumbles: 0,
    },
    events: [],
    nextChunkAt: 24,
    lastChunkId: "",
    spawnSector: 0,
    lastPowerAt: -Infinity,
    nextId: 1,
    queue: [],
    dustStreak: 0,
    lastDustAt: -Infinity,
  };
}

/**
 * Picks the next chunk for a sector: the sector's own chunks most often,
 * the easy early ones less and less as you go.
 */
export function pickChunk(sector: number, rng: Rng, avoid = ""): Chunk {
  const pool = CHUNKS.filter((c) => c.minSector <= sector && c.id !== avoid);
  const age = (c: Chunk) => sector - c.minSector;
  const weight = (c: Chunk) =>
    c.weight * (age(c) === 0 ? 3 : age(c) <= 2 ? 1 : 0.35);
  let roll = rng() * pool.reduce((sum, c) => sum + weight(c), 0);
  for (const chunk of pool) {
    roll -= weight(chunk);
    if (roll < 0) return chunk;
  }
  return pool[pool.length - 1];
}

const POWER_WEIGHTS: Record<PowerUpKind, number> = {
  warp: 2,
  magnet: 3,
  boots: 2,
  twin: 2,
  shield: 2,
};

function pickPowerUp(rng: Rng): PowerUpKind {
  const total = POWER_UPS.reduce((s, k) => s + POWER_WEIGHTS[k], 0);
  let roll = rng() * total;
  for (const kind of POWER_UPS) {
    roll -= POWER_WEIGHTS[kind];
    if (roll < 0) return kind;
  }
  return "magnet";
}

/** Lays a chunk out on the track starting at `start`. */
export function placeChunk(run: Run, chunk: Chunk, start: number, rng: Rng) {
  for (const cell of chunkCells(chunk)) {
    const at = start + cell.at;
    if (cell.kind === "power") {
      if (at - run.lastPowerAt >= CONFIG.powerUpSpacing) {
        run.lastPowerAt = at;
        run.pickups.push({
          id: run.nextId++,
          kind: pickPowerUp(rng),
          lane: cell.lane,
          z: at,
          taken: false,
        });
      } else {
        for (let i = 0; i < 3; i++)
          run.dust.push({
            id: run.nextId++,
            lane: cell.lane,
            z: at + (i - 1) * CONFIG.stardustSpacing,
            y: 0.9,
            taken: false,
          });
      }
      continue;
    }
    let z = at;
    if (cell.kind === "freighter") {
      // It waits until you're `freighterWake` away, then comes at you, and
      // the two of you meet at `at`, where the chunk designer put it.
      const ahead = at - run.distance;
      const v = speedAt(run.elapsed + ahead / run.speed);
      const vF = CONFIG.freighterSpeed;
      z = at + (CONFIG.freighterWake * vF) / (v + vF);
    }
    run.obstacles.push({
      id: run.nextId++,
      kind: cell.kind,
      lane: cell.lane,
      z,
      awake: false,
      hit: false,
      smashed: false,
      wasAlongside: false,
      wasInLane: false,
      wasClear: true,
    });
  }
  for (const coins of chunk.coins) {
    for (const pos of coinPositions(coins, CONFIG.stardustSpacing)) {
      run.dust.push({
        id: run.nextId++,
        lane: coins.lane,
        z: start + pos.at,
        y: pos.y,
        taken: false,
      });
    }
  }
}

function spawnTrack(run: Run, rng: Rng) {
  while (run.nextChunkAt < run.distance + CONFIG.spawnAhead) {
    const start = run.nextChunkAt;
    const sector = sectorAt(start);
    let chunk: Chunk;
    if (sector > run.spawnSector) {
      run.spawnSector = sector;
      chunk = BREATHER;
    } else {
      chunk = pickChunk(sector, rng, run.lastChunkId);
    }
    run.lastChunkId = chunk.id;
    placeChunk(run, chunk, start, rng);
    run.nextChunkAt = start + chunk.length + chunkGapAt(run.elapsed);
  }
}

function changeLane(p: Player, to: number) {
  p.fromX = playerX(p);
  p.prevLane = p.lane;
  p.lane = to;
  p.laneT = 0;
}

/** Tries a buffered move. Returns false if it has to wait (e.g. jump in mid-air). */
function tryAction(run: Run, action: Action): boolean {
  const p = run.player;
  switch (action) {
    case "left":
    case "right": {
      const to = p.lane + (action === "left" ? -1 : 1);
      if (to >= 0 && to <= 2) {
        changeLane(p, to);
        run.events.push({ type: "lane" });
      }
      return true;
    }
    case "up": {
      if (!isGrounded(p)) return false;
      p.slide = 0;
      p.vy =
        run.active.boots > 0 ? CONFIG.boots.jumpVelocity : CONFIG.jumpVelocity;
      run.stats.jumps++;
      run.events.push({ type: "jump" });
      return true;
    }
    case "down": {
      if (isGrounded(p)) {
        p.slide = CONFIG.slideTime;
        run.stats.slides++;
        run.events.push({ type: "slide" });
      } else {
        p.vy = Math.min(p.vy, -CONFIG.dropVelocity);
        p.slideOnLanding = true;
        run.events.push({ type: "drop" });
      }
      return true;
    }
  }
}

function stumble(run: Run, o: Obstacle, side: boolean) {
  const p = run.player;
  o.hit = true;
  run.stats.stumbles++;
  if (run.elapsed - run.lastStumble <= CONFIG.stumbleWindow) {
    run.over = "caught";
    run.gloopGap = 0;
    run.events.push({ type: "caught" });
    return;
  }
  run.lastStumble = run.elapsed;
  run.grace = CONFIG.graceTime;
  run.gloopGap = CONFIG.gloop.near;
  if (side) changeLane(p, p.prevLane);
  run.events.push({ type: "stumble", lane: o.lane, z: o.z });
}

/** Is the player clear of an obstacle vertically (over or under it)? */
function verticallyClear(p: Player, kind: ObstacleKind): boolean {
  const o = OBSTACLES[kind];
  if (kind === "gate") return p.y + playerHeight(p) <= o.bottom;
  return p.y >= o.top - 0.05;
}

function collide(run: Run) {
  const p = run.player;
  const x = playerX(p);
  const near = run.distance - PLAYER.halfDepth;
  const far = run.distance + PLAYER.halfDepth;
  for (const o of run.obstacles) {
    if (o.hit) continue;
    const depth = OBSTACLES[o.kind].depth;
    if (o.z > far + 30 || o.z + depth < near - 5) continue;
    const alongside = o.z < far && o.z + depth > near;
    const inLane =
      Math.abs(x - laneX(o.lane)) < OBSTACLE_HALF_WIDTH + PLAYER.halfWidth;
    const clear = verticallyClear(p, o.kind);
    const touching = alongside && inLane && !clear;
    const wasAlongside = o.wasAlongside;
    const wasInLane = o.wasInLane;
    const wasClear = o.wasClear;
    o.wasAlongside = alongside;
    o.wasInLane = inLane;
    o.wasClear = clear;
    if (!touching) continue;

    const tall = OBSTACLES[o.kind].tall;
    if (tall && wasAlongside && wasInLane && wasClear && p.vy <= 0) {
      // Came down on top of a pod or freighter: boing!
      p.y = OBSTACLES[o.kind].top;
      p.vy = CONFIG.boots.jumpVelocity;
      o.wasClear = true;
      run.events.push({ type: "boing" });
      continue;
    }
    if (run.active.warp > 0) {
      o.hit = o.smashed = true;
      run.events.push({ type: "smash", lane: o.lane, z: o.z });
      continue;
    }
    if (run.grace > 0) {
      o.hit = true;
      continue;
    }
    if (run.active.shield > 0) {
      run.active.shield = 0;
      o.hit = o.smashed = true;
      run.grace = CONFIG.graceTime;
      run.events.push({ type: "shield", lane: o.lane, z: o.z });
      continue;
    }
    const side = wasAlongside && !wasInLane;
    if (side || !tall) {
      stumble(run, o, side);
    } else {
      o.hit = true;
      run.over = "crash";
      run.events.push({ type: "crash" });
    }
    if (run.over) return;
  }
}

function collect(run: Run) {
  const p = run.player;
  const x = playerX(p);
  const mid = p.y + playerHeight(p) / 2;
  const magnet = run.active.magnet > 0;
  for (const d of run.dust) {
    if (d.taken || Math.abs(d.z - run.distance) > 1) continue;
    const reached =
      magnet || (Math.abs(x - laneX(d.lane)) < 1 && Math.abs(d.y - mid) < 1.3);
    if (!reached) continue;
    d.taken = true;
    run.stardust++;
    run.stats.stardust++;
    run.dustStreak =
      run.elapsed - run.lastDustAt < 0.5 ? run.dustStreak + 1 : 0;
    run.lastDustAt = run.elapsed;
    run.events.push({ type: "dust", streak: run.dustStreak });
  }
  for (const u of run.pickups) {
    if (u.taken || Math.abs(u.z - run.distance) > 1) continue;
    if (Math.abs(x - laneX(u.lane)) >= 1.1 || p.y > 2.5) continue;
    u.taken = true;
    run.active[u.kind] = powerUpTime(u.kind, run.upgrades[u.kind]);
    run.stats.powerUps++;
    run.events.push({ type: "power", kind: u.kind });
  }
}

/**
 * Advances the run by `dt` seconds. `actions` are moves pressed since the
 * last step; they wait in a short buffer until they can happen.
 */
export function stepRun(
  run: Run,
  dt: number,
  rng: Rng,
  actions: readonly Action[] = [],
): Run {
  run.events = [];
  if (run.over) return run;
  const p = run.player;

  run.elapsed += dt;
  run.speed =
    speedAt(run.elapsed) * (run.active.warp > 0 ? CONFIG.warpSpeedFactor : 1);
  const step = run.speed * dt;
  run.distance += step;
  run.score += step * CONFIG.pointsPerMetre * multiplier(run);

  const sector = sectorAt(run.distance);
  if (sector > run.sector) {
    run.sector = sector;
    run.events.push({ type: "sector", sector });
  }

  // Input buffer: try each move, keep the ones that must wait (briefly).
  for (const action of actions) run.queue.push({ action, at: run.elapsed });
  run.queue = run.queue.filter(
    (q) => run.elapsed - q.at <= CONFIG.bufferTime && !tryAction(run, q.action),
  );

  // Moving
  p.laneT = Math.min(1, p.laneT + dt / CONFIG.laneTime);
  const gravity =
    CONFIG.gravity * (run.active.boots > 0 ? CONFIG.boots.gravityFactor : 1);
  if (p.y > 0 || p.vy > 0) {
    p.vy -= gravity * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      run.events.push({ type: "land" });
      if (p.slideOnLanding) {
        p.slideOnLanding = false;
        p.slide = CONFIG.slideTime;
        run.stats.slides++;
        run.events.push({ type: "slide" });
      }
    }
  }
  p.slide = Math.max(0, p.slide - dt);

  for (const o of run.obstacles) {
    if (o.kind !== "freighter") continue;
    if (!o.awake && o.z - run.distance <= CONFIG.freighterWake) o.awake = true;
    if (o.awake) o.z -= CONFIG.freighterSpeed * dt;
  }

  collide(run);
  if (run.over) return run;
  collect(run);

  // Timers
  run.grace = Math.max(0, run.grace - dt);
  for (const kind of POWER_UPS) {
    if (run.active[kind] <= 0) continue;
    run.active[kind] = Math.max(0, run.active[kind] - dt);
    if (run.active[kind] === 0) {
      run.events.push({ type: "powerEnd", kind });
      // Coming out of a warp inside something shouldn't count as a bump.
      if (kind === "warp") run.grace = CONFIG.graceTime;
    }
  }
  const g = CONFIG.gloop;
  const sinceBump = Math.min(run.elapsed, run.elapsed - run.lastStumble);
  run.gloopGap =
    sinceBump < g.driftTime
      ? g.near
      : Math.min(g.far, run.gloopGap + ((g.far - g.near) / g.driftTime) * dt);

  // Track: build ahead, recycle behind.
  spawnTrack(run, rng);
  const behind = run.distance - CONFIG.despawnBehind;
  run.obstacles = run.obstacles.filter((o) => {
    const gone = o.z + OBSTACLES[o.kind].depth < behind;
    if (gone && o.kind === "freighter" && !o.hit) run.stats.freightersDodged++;
    return !gone;
  });
  run.dust = run.dust.filter((d) => d.z >= behind && !d.taken);
  run.pickups = run.pickups.filter((u) => u.z >= behind && !u.taken);
  return run;
}

/** Whole points so far. */
export const scoreOf = (run: Run) => Math.floor(run.score);
