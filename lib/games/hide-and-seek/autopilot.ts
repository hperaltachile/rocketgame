/**
 * Test-only hider bots, used to check the balance:
 * - "camper" hides in the nearest spot and never moves;
 * - "smart" plays like a sensible kid: hides, and when Peeka has moved on,
 *   slips into a spot Peeka just checked (the ✓ clue).
 * The bots only use what a player could see: Peeka's position when it's on
 * screen, the ✓ marks and the "Peeka is close" warning.
 */

import { ROUND, TILE, VIEW_H, VIEW_W } from "./config";
import {
  exitRisk,
  nearSpot,
  spotStatus,
  step,
  type Game,
  type Input,
} from "./logic";
import { centerOf, findPath, tileOf, type Tile } from "./nav";

export type Bot = "camper" | "smart";

type Brain = { target: string | null; path: Tile[]; repath: number };

/** Peeka's position if it would be on the player's screen. */
function visibleSeeker(game: Game) {
  const p = game.player;
  const s = game.seeker;
  if (Math.abs(s.x - p.x) <= VIEW_W / 2 && Math.abs(s.y - p.y) <= VIEW_H / 2)
    return s;
  return null;
}

function pathLength(game: Game, to: Tile) {
  const path = findPath(game.grid, tileOf(game.player.x, game.player.y), to);
  return path ? path.length : Infinity;
}

function chooseTarget(game: Game, bot: Bot): string | null {
  const seeker = visibleSeeker(game);
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const spot of game.grid.spots) {
    const status = spotStatus(game, spot.id);
    if (status === "busy") continue;
    const len = pathLength(game, spot.approach);
    if (len === Infinity) continue;
    let score = -len;
    if (bot === "smart") {
      if (seeker) {
        const d = Math.hypot(spot.x - seeker.x, spot.y - seeker.y) / TILE;
        if (d < 5) continue;
      }
      score =
        (status === "checked" ? 40 : 0) + (1 - spot.suspicion) * 12 - len * 0.6;
    }
    if (score > bestScore) {
      bestScore = score;
      best = spot.id;
    }
  }
  return best;
}

/** Peeka is close: the nearest spot that's away from it. */
function fleeTarget(game: Game): string | null {
  const s = game.seeker;
  const p = game.player;
  const mine = Math.hypot(s.x - p.x, s.y - p.y);
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const spot of game.grid.spots) {
    if (spotStatus(game, spot.id) === "busy") continue;
    const len = pathLength(game, spot.approach);
    if (len > 14) continue;
    const away = Math.hypot(spot.x - s.x, spot.y - s.y);
    const score = (away - mine) / TILE - len * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = spot.id;
    }
  }
  return best ?? chooseTarget(game, "smart");
}

function steer(game: Game, brain: Brain, run: boolean): Input {
  const p = game.player;
  while (brain.path.length > 0) {
    const c = centerOf(brain.path[0]);
    if (Math.hypot(c.x - p.x, c.y - p.y) < 2.5) brain.path.shift();
    else break;
  }
  if (brain.path.length === 0) return { x: 0, y: 0, run: false };
  const c = centerOf(brain.path[0]);
  const dx = c.x - p.x;
  const dy = c.y - p.y;
  const d = Math.hypot(dx, dy);
  return { x: dx / d, y: dy / d, run };
}

/** Plays one step for the bot. */
export function botStep(game: Game, bot: Bot, brain: Brain) {
  const p = game.player;
  if (p.trans) return step(game, { x: 0, y: 0, run: false });

  if (p.hidden) {
    if (bot === "camper") return step(game, { x: 0, y: 0, run: false });
    const mine = spotStatus(game, p.hidden);
    const seeker = visibleSeeker(game);
    const safeToMove =
      mine !== "checked" &&
      game.phase === "play" &&
      !exitRisk(game) &&
      (!seeker || Math.hypot(seeker.x - p.x, seeker.y - p.y) / TILE >= 7);
    const better = game.grid.spots.some(
      (s) =>
        s.id !== p.hidden &&
        spotStatus(game, s.id) === "checked" &&
        pathLength(game, s.approach) < 30,
    );
    if (safeToMove && better && game.time > 6) {
      brain.target = null;
      return step(game, { x: 0, y: 0, run: false }, true);
    }
    return step(game, { x: 0, y: 0, run: false });
  }

  brain.repath -= 1;
  const seeker = visibleSeeker(game);
  const danger =
    bot === "smart" &&
    game.phase === "play" &&
    seeker !== null &&
    Math.hypot(seeker.x - p.x, seeker.y - p.y) / TILE < 7;
  if (
    !brain.target ||
    spotStatus(game, brain.target) === "busy" ||
    brain.repath <= 0 ||
    (danger && brain.repath % 10 === 0)
  ) {
    brain.target = danger ? fleeTarget(game) : chooseTarget(game, bot);
    brain.repath = 30;
    brain.path = brain.target
      ? (findPath(
          game.grid,
          tileOf(p.x, p.y),
          game.grid.spots.find((s) => s.id === brain.target)!.approach,
        ) ?? [])
      : [];
  }
  if (brain.target && nearSpot(game) === brain.target) {
    return step(game, { x: 0, y: 0, run: false }, true);
  }
  const counting = game.phase === "countdown";
  return step(game, steer(game, brain, counting));
}

export type RoundResult = { won: boolean; game: Game };

/** Plays rounds with a bot until it's caught or `maxRounds` are won. */
export function playBot(game: Game, bot: Bot, maxRounds = 1) {
  const brain: Brain = { target: null, path: [], repath: 0 };
  const limit =
    (ROUND.headStart + ROUND.duration + ROUND.wonPause + 5) * 60 * maxRounds;
  for (let i = 0; i < limit; i++) {
    if (game.phase === "over" || game.phase === "caught") break;
    if (game.roundsWon >= maxRounds) break;
    if (game.phase === "countdown" && game.phaseT === 0) {
      brain.target = null;
      brain.path = [];
    }
    botStep(game, bot, brain);
    game.events.length = 0;
  }
  return game;
}
