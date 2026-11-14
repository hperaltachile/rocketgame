/**
 * Big Clank, the grumpy moon robot at the end of each fortress. It paces a
 * short stretch of its bridge, hops now and then and tosses slow bouncing
 * bolts at Kit. Three stomps (or five sparks) beat it; jumping over it and
 * pressing the power switch works too: its power goes off and it floats
 * away, grumbling. Its floor is flat, so it needs no tile collisions.
 */

import { BOSS, TILE, VIEW_W } from "./config";
import type { Box } from "./hazards";
import type { Game } from "./logic";

export type BossState = "sleep" | "pace" | "down";

export type Boss = Box & {
  vy: number;
  /** Feet height when standing (the bridge top). */
  floor: number;
  minX: number;
  maxX: number;
  dir: 1 | -1;
  /** Faces Kit: -1 left, 1 right. */
  facing: 1 | -1;
  state: BossState;
  hp: number;
  /** Seconds left of flashing after a hit (it can't hurt Kit then). */
  hurt: number;
  hopTimer: number;
  boltTimer: number;
  /** Seconds since it powered down (it floats away). */
  downTime: number;
  speed: number;
  boltEvery: number;
};

export type Bolt = Box & { id: number; vx: number; vy: number; age: number };

export type BossTuning = { speed?: number; boltEvery?: number };

/** A sleeping Big Clank standing on the tile at (col, row). */
export function newBoss(col: number, row: number, tuning: BossTuning = {}) {
  const floor = (row + 1) * TILE;
  const x = col * TILE + (TILE - BOSS.w) / 2;
  const boss: Boss = {
    x,
    y: floor - BOSS.h,
    w: BOSS.w,
    h: BOSS.h,
    vy: 0,
    floor,
    minX: x - BOSS.range,
    maxX: x + BOSS.range,
    dir: -1,
    facing: -1,
    state: "sleep",
    hp: BOSS.hp,
    hurt: 0,
    hopTimer: BOSS.hopEvery,
    boltTimer: 1.2,
    downTime: 0,
    speed: tuning.speed ?? BOSS.speed,
    boltEvery: tuning.boltEvery ?? BOSS.boltEvery,
  };
  return boss;
}

/** Whether Big Clank can still hurt Kit or be hit. */
export const bossActive = (boss: Boss | null): boss is Boss =>
  boss !== null && boss.state === "pace";

/** Hits Big Clank for `damage`; returns true if that beat it. */
export function damageBoss(game: Game, damage: number, hurt: number): boolean {
  const boss = game.boss;
  if (!bossActive(boss)) return false;
  boss.hp -= damage;
  boss.hurt = Math.max(boss.hurt, hurt);
  if (boss.hp <= 0) {
    powerDown(game);
    return true;
  }
  game.events.push({ type: "bossHit" });
  return false;
}

/** Big Clank's power goes off: it stops, sputters and floats away. */
export function powerDown(game: Game) {
  const boss = game.boss;
  if (!boss || boss.state === "down") return;
  boss.state = "down";
  boss.downTime = 0;
  boss.vy = 0;
  game.bolts = [];
  game.events.push({ type: "bossDown" });
}

export function updateBoss(game: Game, dt: number) {
  const boss = game.boss;
  if (boss) {
    if (boss.state === "sleep") {
      // Wakes up once it's fully on screen.
      if (boss.x + boss.w <= game.camX + VIEW_W) {
        boss.state = "pace";
        game.events.push({ type: "bossWake" });
      }
    } else if (boss.state === "down") {
      boss.downTime += dt;
      if (boss.downTime > 0.8)
        boss.y -= BOSS.float * (boss.downTime - 0.6) * dt;
    } else {
      pace(game, boss, dt);
    }
  }
  updateBolts(game, dt);
}

function pace(game: Game, boss: Boss, dt: number) {
  const p = game.player;
  boss.hurt = Math.max(0, boss.hurt - dt);
  boss.facing = p.x + p.w / 2 < boss.x + boss.w / 2 ? -1 : 1;

  boss.x += boss.dir * boss.speed * dt;
  if (boss.x <= boss.minX) {
    boss.x = boss.minX;
    boss.dir = 1;
  } else if (boss.x >= boss.maxX) {
    boss.x = boss.maxX;
    boss.dir = -1;
  }

  const standing = boss.y + boss.h >= boss.floor;
  boss.hopTimer -= dt;
  if (standing && boss.hopTimer <= 0) {
    boss.vy = -BOSS.hopJump;
    boss.hopTimer = BOSS.hopEvery;
  }
  boss.vy += BOSS.gravity * dt;
  boss.y += boss.vy * dt;
  if (boss.y + boss.h >= boss.floor) {
    boss.y = boss.floor - boss.h;
    boss.vy = 0;
  }

  boss.boltTimer -= dt;
  const distance = Math.abs(p.x + p.w / 2 - (boss.x + boss.w / 2));
  if (boss.boltTimer <= 0 && boss.hurt <= 0 && distance < BOSS.boltRange) {
    boss.boltTimer = boss.boltEvery;
    const s = BOSS.boltSize;
    game.bolts.push({
      id: game.nextId++,
      x: boss.facing < 0 ? boss.x - s : boss.x + boss.w,
      y: boss.y + 8,
      w: s,
      h: s,
      vx: boss.facing * BOSS.boltSpeed,
      vy: -BOSS.boltBounce * 0.6,
      age: 0,
    });
    game.events.push({ type: "bolt" });
  }
}

/** Bolts bounce along the bridge's height, then fizzle out. */
function updateBolts(game: Game, dt: number) {
  const floor = game.boss?.floor ?? Infinity;
  game.bolts = game.bolts.filter((b) => {
    b.age += dt;
    b.vy += BOSS.boltGravity * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y + b.h >= floor) {
      b.y = floor - b.h;
      b.vy = -BOSS.boltBounce;
    }
    return (
      b.age < BOSS.boltLife &&
      b.x + b.w > game.camX - 8 &&
      b.x < game.camX + VIEW_W + 8
    );
  });
}
