/**
 * Test-only autopilot: a simple stand-in for a kid playing Astro Hop. It
 * walks right (no Run) and jumps at walls, gaps and enemies, and waits for
 * moving platforms. The level tests use it to check every level can be
 * finished.
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

export function autopilotInput(game: Game, memory: { hold: number }): Input {
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
  if (wall || gap || enemy) {
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
