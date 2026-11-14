/**
 * Peeka the seeker: a small state machine (patrol, suspicious, investigate,
 * search, chase) driven by fair senses. Peeka never knows where a hidden
 * player is: it can only find them by opening the right spot.
 */

import { SEEKER, TILE } from "./config";
import { roomAt } from "./house";
import {
  centerOf,
  distanceField,
  findPath,
  isDoor,
  isSolid,
  lineOfSight,
  tileOf,
  type Tile,
} from "./nav";
import {
  angleDiff,
  catchPlayer,
  emit,
  exposed,
  inView,
  patrolLap,
  remembered,
  roomWaypoint,
  spotById,
  type Game,
  type NoiseKind,
} from "./state";

/** Peeka stops counting and starts looking. */
export function startSeeking(game: Game) {
  const s = game.seeker;
  s.mode = "patrol";
  s.rooms = patrolLap(game);
  s.room = null;
  s.path = [];
}

/** A sound: Peeka hears it if it's close enough along the floor (walls muffle). */
export function hearNoise(
  game: Game,
  x: number,
  y: number,
  radius: number,
  kind: NoiseKind,
) {
  const s = game.seeker;
  emit(game, { type: "noise", x, y, radius, kind });
  if (game.phase !== "play" || s.mode === "count" || s.mode === "chase") return;
  const dist = distanceField(game.grid, tileOf(x, y));
  const [c, r] = tileOf(s.x, s.y);
  const d = dist[r * game.grid.cols + c];
  if (d < 0 || d > radius * game.tuning.hearing) return;
  s.clue = { kind: "sound", x, y, at: game.clock, noise: kind };
  emit(game, { type: "heard", x, y });
  becomeSuspicious(game);
}

function becomeSuspicious(game: Game) {
  const s = game.seeker;
  s.mode = "suspicious";
  s.wait = game.tuning.reaction;
  s.look = 0;
  s.path = [];
  s.queue = [];
  s.inspecting = null;
  emit(game, { type: "suspicious" });
}

function playerIn(game: Game, spot: string) {
  const p = game.player;
  return p.hidden === spot || p.trans?.spot === spot;
}

const spotWeight = (game: Game, id: string) =>
  spotById(game, id).suspicion *
  (1 + game.tuning.learning * (game.hideCounts[id] ?? 0));

/** Which spots of a room Peeka decides to open, most likely first. */
export function roomSearch(game: Game, room: string): string[] {
  const picks: { id: string; w: number }[] = [];
  for (const spot of game.grid.spots) {
    if (spot.room !== room || remembered(game, spot.id)) continue;
    const w = spotWeight(game, spot.id);
    if (game.rng() < Math.min(1, w * game.tuning.thorough)) {
      picks.push({ id: spot.id, w: w * (0.6 + 0.8 * game.rng()) });
    }
  }
  return picks.sort((a, b) => b.w - a.w).map((p) => p.id);
}

/** Spots worth opening around a clue, most likely first. */
export function clueSearch(game: Game): string[] {
  const s = game.seeker;
  const clue = s.clue;
  if (!clue) return [];
  const picks: { id: string; w: number }[] = [];
  for (const spot of game.grid.spots) {
    if (spot.id === clue.spot) continue;
    const d = Math.hypot(spot.x - clue.x, spot.y - clue.y) / TILE;
    if (d > SEEKER.clueRadius || remembered(game, spot.id)) continue;
    const w =
      (spotWeight(game, spot.id) / (1 + 0.35 * d)) * (0.7 + 0.6 * game.rng());
    picks.push({ id: spot.id, w });
  }
  const ids = picks
    .sort((a, b) => b.w - a.w)
    .slice(0, SEEKER.clueChecks)
    .map((p) => p.id);
  return clue.spot ? [clue.spot, ...ids] : ids;
}

/** Turns Peeka toward an angle at its turning speed. */
function turnToward(game: Game, target: number, dt: number) {
  const s = game.seeker;
  const d = angleDiff(target, s.angle);
  const max = SEEKER.turn * dt;
  s.angle += Math.max(-max, Math.min(max, d));
}

/** Walks along the path. Returns true when it's done (or empty). */
function follow(game: Game, speed: number, dt: number): boolean {
  const s = game.seeker;
  let budget = speed * dt;
  while (budget > 0 && s.path.length > 0) {
    const target = centerOf(s.path[0]);
    const dx = target.x - s.x;
    const dy = target.y - s.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01) turnToward(game, Math.atan2(dy, dx), dt);
    if (d <= budget) {
      s.x = target.x;
      s.y = target.y;
      budget -= d;
      const reached = s.path.shift()!;
      if (
        s.mode === "patrol" &&
        isDoor(game.grid, reached[0], reached[1]) &&
        s.path.length > 0 &&
        !isDoor(game.grid, s.path[0][0], s.path[0][1]) &&
        game.rng() < 0.5
      ) {
        s.wait = SEEKER.doorPause;
        break;
      }
    } else {
      s.x += (dx / d) * budget;
      s.y += (dy / d) * budget;
      budget = 0;
    }
  }
  if (s.path.length > 0 || budget < speed * dt) {
    s.stepT += dt;
    if (s.stepT >= 0.42) {
      s.stepT = 0;
      emit(game, { type: "seekerStep" });
    }
  }
  return s.path.length === 0;
}

/** Plans a path to a tile. False if Peeka is already there or it can't be reached. */
function goTo(game: Game, tile: Tile): boolean {
  const s = game.seeker;
  const here = tileOf(s.x, s.y);
  const path = findPath(game.grid, here, tile);
  if (!path) return false;
  // Step back onto the centre of the current tile first, if off it.
  const c = centerOf(here);
  if (Math.hypot(c.x - s.x, c.y - s.y) > 0.5 && path.length === 0)
    path.push(here);
  s.path = path;
  return path.length > 0;
}

const atTile = (game: Game, tile: Tile) => {
  const c = centerOf(tile);
  return Math.hypot(c.x - game.seeker.x, c.y - game.seeker.y) < 0.6;
};

function nextRoom(game: Game) {
  const s = game.seeker;
  if (s.rooms.length === 0) s.rooms = patrolLap(game, s.room ?? undefined);
  // After a clue, carry on from the room nearest to it.
  if (s.clue && s.reason !== "patrol") {
    const clue = s.clue;
    let best = 0;
    let bestD = Infinity;
    s.rooms.forEach((id, i) => {
      const [c, r] = roomWaypoint(game, id);
      const d = Math.hypot(c * TILE - clue.x, r * TILE - clue.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    s.rooms.unshift(...s.rooms.splice(best, 1));
  }
  s.room = s.rooms.shift()!;
  s.mode = "patrol";
  s.reason = "patrol";
  s.clue = null;
  s.path = [];
  goTo(game, roomWaypoint(game, s.room));
}

function startChase(game: Game) {
  const s = game.seeker;
  s.mode = "chase";
  s.wait = 0;
  s.look = 0;
  s.queue = [];
  s.inspecting = null;
  s.path = [];
  s.replan = 0;
  emit(game, { type: "chase" });
}

/** Sight: fills the glimpse meter while Peeka's flashlight is on you. */
function perceive(game: Game, dt: number) {
  const s = game.seeker;
  const p = game.player;
  const t = game.tuning;
  const sees = exposed(game) && inView(game, p.x, p.y);
  s.sees = sees;
  if (sees) {
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    const near = 1 - Math.min(1, d / (t.range * TILE));
    s.glimpse = Math.min(1, s.glimpse + (dt / t.glimpse) * (1 + 1.5 * near));
    s.lastSeen = { x: p.x, y: p.y };
    if (p.trans?.kind === "enter") {
      const spot = spotById(game, p.trans.spot);
      s.clue = {
        kind: "hide",
        x: spot.x,
        y: spot.y,
        at: game.clock,
        spot: spot.id,
      };
    }
  } else {
    s.glimpse = Math.max(0, s.glimpse - SEEKER.glimpseDecay * dt);
  }
  if (s.mode === "chase" || game.phase !== "play") return;
  if (sees && s.glimpse >= 1) startChase(game);
  else if (
    sees &&
    s.glimpse >= SEEKER.suspiciousAt &&
    s.mode !== "suspicious" &&
    s.clue?.kind !== "hide"
  ) {
    s.clue = { kind: "sight", x: p.x, y: p.y, at: game.clock };
    becomeSuspicious(game);
  } else if (sees && s.mode === "suspicious") {
    // Keep looking at you while deciding.
    s.clue =
      s.clue?.kind === "hide"
        ? s.clue
        : { kind: "sight", x: p.x, y: p.y, at: game.clock };
  }
}

export function updateSeeker(game: Game, dt: number) {
  const s = game.seeker;
  const t = game.tuning;
  if (s.mode === "count") return;
  perceive(game, dt);
  if (game.phase !== "play") return;
  const p = game.player;

  // Bumping into Peeka in plain sight is always a catch.
  if (
    s.sees &&
    Math.hypot(p.x - s.x, p.y - s.y) < SEEKER.catchDistance &&
    exposed(game)
  ) {
    catchPlayer(game, { kind: "seen", room: roomAt(...tileOf(p.x, p.y)).name });
    return;
  }

  if (s.wait > 0 && s.mode !== "suspicious" && s.mode !== "chase") {
    s.wait -= dt;
    return;
  }

  switch (s.mode) {
    case "suspicious": {
      if (s.clue)
        turnToward(game, Math.atan2(s.clue.y - s.y, s.clue.x - s.x), dt);
      s.wait -= dt;
      if (s.wait <= 0) {
        s.mode = "investigate";
        s.reason = s.clue?.kind ?? "sight";
        s.path = [];
        s.look = 0;
        planInvestigation(game);
      }
      break;
    }

    case "investigate": {
      if (!s.clue || game.clock - s.clue.at > SEEKER.clueLife + 6) {
        nextRoom(game);
        break;
      }
      if (s.look > 0) {
        s.angle += ((Math.PI * 2) / SEEKER.lookAround) * dt;
        s.look -= dt;
        if (s.look <= 0) beginSearch(game, clueSearch(game));
        break;
      }
      if (follow(game, t.speed * 1.1, dt)) {
        if (s.clue.kind === "hide") beginSearch(game, clueSearch(game));
        else s.look = SEEKER.lookAround * 0.7;
      }
      break;
    }

    case "patrol": {
      if (s.look > 0) {
        s.angle += ((Math.PI * 2) / SEEKER.lookAround) * dt;
        s.look -= dt;
        if (s.look <= 0) beginSearch(game, roomSearch(game, s.room!));
        break;
      }
      if (!s.room) {
        nextRoom(game);
        break;
      }
      if (follow(game, t.speed, dt)) {
        if (atTile(game, roomWaypoint(game, s.room)))
          s.look = SEEKER.lookAround;
        else if (!goTo(game, roomWaypoint(game, s.room)))
          s.look = SEEKER.lookAround;
      }
      break;
    }

    case "search": {
      if (s.inspecting) {
        const spot = spotById(game, s.inspecting.spot);
        turnToward(game, Math.atan2(spot.y - s.y, spot.x - s.x), dt);
        s.inspecting.t += dt;
        if (s.inspecting.t >= t.inspect) {
          if (playerIn(game, spot.id)) {
            catchPlayer(game, {
              kind: "checked",
              spot: spot.id,
              because: s.reason,
              noise: s.clue?.noise,
            });
            return;
          }
          s.checked[spot.id] = game.clock;
          s.inspecting = null;
          emit(game, { type: "checked", spot: spot.id });
        }
        break;
      }
      // Drop spots checked in the meantime (except the one you were seen entering).
      while (
        s.queue.length > 0 &&
        s.queue[0] !== s.clue?.spot &&
        remembered(game, s.queue[0])
      )
        s.queue.shift();
      if (s.queue.length === 0) {
        nextRoom(game);
        break;
      }
      const spot = spotById(game, s.queue[0]);
      if (atTile(game, spot.approach)) {
        s.queue.shift();
        s.path = [];
        s.inspecting = { spot: spot.id, t: 0 };
        emit(game, { type: "inspect", spot: spot.id });
        break;
      }
      if (s.path.length === 0 && !goTo(game, spot.approach)) {
        s.queue.shift();
        break;
      }
      follow(game, t.speed * (s.reason === "patrol" ? 1 : 1.1), dt);
      break;
    }

    case "chase": {
      const speed = t.chaseSpeed;
      if (s.sees) {
        const d = Math.hypot(p.x - s.x, p.y - s.y);
        // Close and nothing in the way: go straight for it.
        if (d < TILE * 1.6 && lineOfSight(game.grid, s.x, s.y, p.x, p.y)) {
          const step = Math.min(d, speed * dt);
          const nx = s.x + ((p.x - s.x) / d) * step;
          const ny = s.y + ((p.y - s.y) / d) * step;
          const [c, r] = tileOf(nx, ny);
          if (!isSolid(game.grid, c, r)) {
            s.x = nx;
            s.y = ny;
          }
          turnToward(game, Math.atan2(p.y - s.y, p.x - s.x), dt);
          s.path = [];
        } else {
          s.replan -= dt;
          if (s.replan <= 0 || s.path.length === 0) {
            s.replan = 0.25;
            goTo(game, tileOf(p.x, p.y));
          }
          follow(game, speed, dt);
        }
        if (d < SEEKER.catchDistance) {
          catchPlayer(game, {
            kind: "seen",
            room: roomAt(...tileOf(p.x, p.y)).name,
          });
        }
        break;
      }
      // Lost sight: head for where you were last seen.
      emit(game, { type: "lost" });
      if (s.clue?.kind !== "hide") {
        const at = s.lastSeen ?? { x: p.x, y: p.y };
        s.clue = { kind: "sight", x: at.x, y: at.y, at: game.clock };
      }
      s.mode = "investigate";
      s.reason = s.clue!.kind;
      s.glimpse = Math.min(s.glimpse, 0.6);
      s.path = [];
      planInvestigation(game);
      break;
    }
  }
}

function planInvestigation(game: Game) {
  const s = game.seeker;
  const clue = s.clue;
  if (!clue) return;
  const target: Tile = clue.spot
    ? spotById(game, clue.spot).approach
    : nearestWalkable(game, tileOf(clue.x, clue.y));
  if (!goTo(game, target)) {
    // Already there (or it can't be reached): look around right away.
    if (clue.kind === "hide") beginSearch(game, clueSearch(game));
    else s.look = SEEKER.lookAround * 0.7;
  }
}

function nearestWalkable(game: Game, [c, r]: Tile): Tile {
  for (let ring = 0; ring < 4; ring++) {
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (!isSolid(game.grid, c + dc, r + dr)) return [c + dc, r + dr];
      }
    }
  }
  return tileOf(game.seeker.x, game.seeker.y);
}

function beginSearch(game: Game, queue: string[]) {
  const s = game.seeker;
  s.queue = queue;
  s.mode = "search";
  s.look = 0;
  s.path = [];
  s.inspecting = null;
  if (s.reason === "patrol") s.clue = null;
}
