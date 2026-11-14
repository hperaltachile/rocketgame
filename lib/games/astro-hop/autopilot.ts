/**
 * Test-only autopilot: a simple stand-in for a kid playing Astro Hop. It
 * walks right (no Run) and jumps at walls, gaps and enemies, and waits for
 * moving platforms. The level tests use it to check every level can be
 * finished.
 *
 * Near fortress hazards (fire bars, lava blips, Big Clank and its bolts) it
 * also looks ahead, the way a kid learns a rhythm: it plays the next moment
 * out on a copy of the game, and if walking on would cost a life or a size,
 * it tries jumping now, waiting or stepping back instead.
 */

import { TILE } from "./config";
import {
  isSolid,
  NO_INPUT,
  step,
  tileAt,
  type Game,
  type Input,
} from "./logic";

function floorAt(game: Game, x: number, feet: number): boolean {
  const col = Math.floor(x / TILE);
  const row = Math.floor((feet + 1) / TILE);
  const ch = tileAt(game, col, row);
  if (isSolid(ch) || ch === "_") return true;
  return game.movers.some(
    (m) => x >= m.x && x <= m.x + m.w && Math.abs(m.y - feet) < 4,
  );
}

type Memory = { hold: number };

/** How far ahead (in ticks) the autopilot plays out its plans near hazards. */
const LOOKAHEAD = 75;

function hazardNear(game: Game): boolean {
  const px = game.player.x;
  const near = (x: number) => x > px - 3 * TILE && x < px + 7 * TILE;
  return (
    game.bolts.length > 0 ||
    game.fireBars.some((b) => near(b.col * TILE)) ||
    game.blips.some((b) => near(b.col * TILE)) ||
    (game.boss !== null && game.boss.state !== "down" && near(game.boss.x))
  );
}

type Plan = "go" | "jump" | "wait" | "back";

function planInput(game: Game, memory: Memory, plan: Plan): Input {
  switch (plan) {
    case "go":
      return baseInput(game, memory);
    case "jump":
      if (game.player.onGround) memory.hold = 22;
      if (memory.hold > 0) memory.hold--;
      return { ...NO_INPUT, right: true, jump: memory.hold > 0 };
    case "wait":
      return NO_INPUT;
    case "back":
      return { ...NO_INPUT, left: true };
  }
}

/** Whether following `plan` (then walking on) keeps Kit safe for a while. */
function planIsSafe(game: Game, memory: Memory, plan: Plan): boolean {
  const sim = structuredClone(game);
  const mem = { ...memory };
  const size = sim.player.size;
  for (let i = 0; i < LOOKAHEAD; i++) {
    // Commit to the plan for a moment, then carry on walking.
    const input = planInput(sim, mem, i < 12 ? plan : "go");
    step(sim, input);
    sim.events.length = 0;
    if (sim.phase === "goal" || sim.phase === "won") return true;
    if (sim.phase !== "play" || sim.player.size !== size) return false;
  }
  return true;
}

export function autopilotInput(game: Game, memory: Memory): Input {
  if (game.phase !== "play" || !hazardNear(game)) {
    return baseInput(game, memory);
  }
  for (const plan of ["go", "jump", "wait", "back"] as const) {
    if (planIsSafe(game, memory, plan)) return planInput(game, memory, plan);
  }
  return baseInput(game, memory);
}

/** The plain walker: right, jumping at walls, gaps and enemies. */
function baseInput(game: Game, memory: Memory): Input {
  const p = game.player;
  if (game.phase !== "play") return NO_INPUT;
  const feet = p.y + p.h;
  const front = p.x + p.w;
  const input: Input = { ...NO_INPUT, right: true };

  if (memory.hold > 0) {
    memory.hold--;
    return { ...input, jump: true };
  }
  if (!p.onGround) return input;

  // A wall or block in the way.
  const top = Math.floor(p.y / TILE);
  const bottom = Math.floor((feet - 1) / TILE);
  let wall = false;
  for (let row = top; row <= bottom; row++) {
    if (isSolid(tileAt(game, Math.floor((front + 4) / TILE), row))) wall = true;
  }
  // The floor ends just ahead.
  const gap = !floorAt(game, front + 3, feet);
  // An enemy close ahead (or a shell to hop over).
  const enemy = game.enemies.some(
    (e) =>
      e.active &&
      e.state !== "flipped" &&
      e.state !== "squashed" &&
      e.x + e.w > p.x - 4 &&
      e.x - front < 30 &&
      Math.abs(e.y + e.h - feet) < 24,
  );
  const boss = game.boss;
  const bossAhead =
    boss !== null &&
    boss.state === "pace" &&
    boss.x + boss.w > p.x &&
    boss.x - front < 30;

  if (gap) {
    // Is there anything to land on within a jump? If only a moving
    // platform, wait for it to come close.
    let landing = false;
    for (let dx = 4; dx <= 52; dx += 4) {
      for (let dy = -40; dy <= 64; dy += 4) {
        if (
          dx <= 40 + Math.max(0, dy - 16) / 2 &&
          floorAt(game, front + dx, feet + dy)
        )
          landing = true;
      }
    }
    if (!landing) return NO_INPUT;
  }
  if (wall || gap || enemy || bossAhead) {
    memory.hold = 22;
    return { ...input, jump: true };
  }
  return input;
}

/** Plays one level; returns whether Kit reached the beacon and how many lives it took. */
export function autoplay(game: Game, maxSeconds = 300) {
  const memory = { hold: 0 };
  const start = game.levelIndex;
  let deaths = 0;
  let wasDying = false;
  for (let i = 0; i < maxSeconds * 60; i++) {
    step(game, autopilotInput(game, memory));
    const dying = game.phase === "dying";
    if (dying && !wasDying) deaths++;
    wasDying = dying;
    if (
      game.phase === "goal" ||
      game.phase === "won" ||
      game.levelIndex !== start
    )
      return { cleared: true, deaths, seconds: i / 60 };
    if (game.phase === "over") break;
  }
  return {
    cleared: false,
    deaths,
    seconds: maxSeconds,
    x: game.player.x / TILE,
  };
}
