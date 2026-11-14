/**
 * Hide & Seek: Mazes rules: player movement and collision, hiding, the round
 * timer and flow. Peeka's brain is in seeker.ts, the house in house.ts.
 */

import {
  CLOSE_CALL_CLEAR,
  CLOSE_CALL_NEAR,
  PLAYER,
  POINTS,
  RISK_NEAR,
  ROUND,
  STEP,
  TILE,
} from "./config";
import { centerOf, isSolid } from "./nav";
import { hearNoise, startSeeking, updateSeeker } from "./seeker";
import {
  emit,
  exposed,
  habitKey,
  roomNameAt,
  inView,
  remembered,
  resetRound,
  spotById,
  type CaughtReason,
  type Game,
  type Input,
} from "./state";

export * from "./state";

/** Advances the game by one fixed step. `act` is a Hide/Exit press this step. */
export function step(game: Game, input: Input, act = false, dt = STEP) {
  if (game.phase === "over") return;
  game.clock += dt;
  game.phaseT += dt;

  switch (game.phase) {
    case "countdown": {
      const before = Math.ceil(ROUND.headStart - (game.phaseT - dt));
      const left = Math.ceil(ROUND.headStart - game.phaseT);
      if (game.phaseT - dt === 0 || left !== before) {
        if (left > 0) emit(game, { type: "countdown", n: left });
      }
      updatePlayer(game, input, act, dt);
      if (game.phaseT >= ROUND.headStart) {
        game.phase = "play";
        game.phaseT = 0;
        startSeeking(game);
        emit(game, { type: "go" });
      }
      return;
    }
    case "play": {
      updatePlayer(game, input, act, dt);
      updateSeeker(game, dt);
      if (game.phase !== "play") return;
      updateCloseCall(game);
      game.time = Math.max(0, game.time - dt);
      const whole = Math.floor(ROUND.duration - game.time + 1e-9);
      if (whole > game.counted) {
        game.score += (whole - game.counted) * POINTS.second;
        game.counted = whole;
        const left = Math.ceil(game.time - 1e-9);
        if (left <= 10 && left > 0) emit(game, { type: "tick", seconds: left });
      }
      if (game.time <= 0) {
        game.phase = "won";
        game.phaseT = 0;
        game.roundsWon += 1;
        game.score += POINTS.roundWon;
        game.seeker.path = [];
        emit(game, { type: "won", round: game.round });
      }
      return;
    }
    case "won": {
      if (game.phaseT >= ROUND.wonPause) nextRound(game);
      return;
    }
    case "caught": {
      updateSeeker(game, dt);
      if (game.phaseT >= ROUND.caughtPause) {
        game.phase = "over";
        emit(game, { type: "over" });
      }
      return;
    }
  }
}

/** Starts the next round: same house, a slightly smarter Peeka. */
export function nextRound(game: Game) {
  game.round += 1;
  resetRound(game);
}

// ------------------------------------------------------------------ player

function updatePlayer(game: Game, input: Input, act: boolean, dt: number) {
  const p = game.player;
  p.bumpT = Math.max(0, p.bumpT - dt);

  if (p.trans) {
    p.trans.t += dt / PLAYER.transition;
    if (p.trans.t >= 1) {
      if (p.trans.kind === "enter") {
        p.hidden = p.trans.spot;
        emit(game, { type: "hidden", spot: p.hidden });
      }
      p.trans = null;
    }
    p.moving = false;
    return;
  }

  if (act) {
    if (p.hidden) leaveSpot(game);
    else {
      const spot = nearSpot(game);
      if (spot && spotStatus(game, spot) !== "busy") enterSpot(game, spot);
    }
    p.moving = false;
    return;
  }
  if (p.hidden) {
    p.moving = false;
    return;
  }

  let { x, y } = input;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  p.moving = len > 0.15;
  p.running = p.moving && input.run;
  if (!p.moving) {
    p.walkT = 0;
    return;
  }
  p.walkT += dt;
  if (Math.abs(x) > Math.abs(y)) p.facing = x > 0 ? "right" : "left";
  else p.facing = y > 0 ? "down" : "up";

  const speed = p.running ? PLAYER.run : PLAYER.walk;
  const wantX = x * speed * dt;
  const wantY = y * speed * dt;
  const startX = p.x;
  const startY = p.y;
  moveAxis(game, wantX, 0);
  moveAxis(game, 0, wantY);
  const want = Math.hypot(wantX, wantY);
  const got = Math.hypot(p.x - startX, p.y - startY);

  if (want > 0 && got < want * 0.4 && p.bumpT === 0) {
    p.bumpT = PLAYER.bumpCooldown;
    emit(game, { type: "bump" });
    if (p.running) hearNoise(game, p.x, p.y, PLAYER.bumpNoise, "bump");
  }

  p.stepT += dt;
  const every = p.running ? PLAYER.stepEvery : PLAYER.stepEvery * 1.5;
  if (p.stepT >= every) {
    p.stepT = 0;
    emit(game, { type: "step", running: p.running });
    if (p.running) hearNoise(game, p.x, p.y, PLAYER.runNoise, "run");
  }
}

/** Moves along one axis and pushes back out of solid tiles (the body is a square). */
function moveAxis(game: Game, dx: number, dy: number) {
  const p = game.player;
  const r = PLAYER.radius;
  p.x += dx;
  p.y += dy;
  const c0 = Math.floor((p.x - r) / TILE);
  const c1 = Math.floor((p.x + r - 0.001) / TILE);
  const r0 = Math.floor((p.y - r) / TILE);
  const r1 = Math.floor((p.y + r - 0.001) / TILE);
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (!isSolid(game.grid, col, row)) continue;
      if (dx > 0) p.x = Math.min(p.x, col * TILE - r);
      else if (dx < 0) p.x = Math.max(p.x, (col + 1) * TILE + r);
      else if (dy > 0) p.y = Math.min(p.y, row * TILE - r);
      else if (dy < 0) p.y = Math.max(p.y, (row + 1) * TILE + r);
    }
  }
}

function enterSpot(game: Game, id: string) {
  const p = game.player;
  p.trans = { kind: "enter", spot: id, t: 0 };
  p.moving = false;
  const habit = habitKey(game, id);
  game.hideCounts[habit] = (game.hideCounts[habit] ?? 0) + 1;
  emit(game, { type: "hide", spot: id });
  hearNoise(game, p.x, p.y, PLAYER.creakNoise, "creak");
}

function leaveSpot(game: Game) {
  const p = game.player;
  const id = p.hidden!;
  const risky = exitRisk(game);
  const spot = spotById(game, id);
  const at = centerOf(spot.approach);
  p.hidden = null;
  p.x = at.x;
  p.y = at.y;
  p.trans = { kind: "exit", spot: id, t: 0 };
  game.closeArmed = false;
  emit(game, { type: "exit", spot: id, risky });
  hearNoise(game, p.x, p.y, PLAYER.creakNoise, "creak");
}

function updateCloseCall(game: Game) {
  const p = game.player;
  if (!p.hidden) return;
  const spot = spotById(game, p.hidden);
  const s = game.seeker;
  const d = Math.hypot(s.x - spot.x, s.y - spot.y) / TILE;
  if (d <= CLOSE_CALL_NEAR) game.closeArmed = true;
  else if (game.closeArmed && d >= CLOSE_CALL_CLEAR) {
    game.closeArmed = false;
    game.closeCalls += 1;
    game.score += POINTS.closeCall;
    emit(game, { type: "closeCall" });
  }
}

// ------------------------------------------------------------------ queries for the scene, the page and bots

/** The hiding spot within reach of the player, if any (closest first). */
export function nearSpot(game: Game): string | null {
  const p = game.player;
  if (p.hidden || p.trans) return null;
  let best: string | null = null;
  let bestD = Infinity;
  for (const spot of game.grid.spots) {
    const f = spot.furniture;
    const nx = Math.max(f.col * TILE, Math.min(p.x, (f.col + f.w) * TILE));
    const ny = Math.max(f.row * TILE, Math.min(p.y, (f.row + f.h) * TILE));
    const d = Math.hypot(p.x - nx, p.y - ny);
    if (d <= PLAYER.reach && d < bestD) {
      bestD = d;
      best = spot.id;
    }
  }
  return best;
}

/**
 * "busy": Peeka is opening it or standing right at it, so you can't get in.
 * "checked": Peeka looked here recently and remembers it was empty (safer).
 * "free": anything else.
 */
export function spotStatus(
  game: Game,
  id: string,
): "busy" | "checked" | "free" {
  const s = game.seeker;
  const spot = spotById(game, id);
  if (s.inspecting?.spot === id) return "busy";
  const a = centerOf(spot.approach);
  if (s.mode !== "count" && Math.hypot(a.x - s.x, a.y - s.y) < TILE * 0.9)
    return "busy";
  if (remembered(game, id)) return "checked";
  return "free";
}

/** Leaving your spot right now would probably get you seen. */
export function exitRisk(game: Game): boolean {
  const p = game.player;
  if (!p.hidden) return false;
  const s = game.seeker;
  if (s.mode === "count") return false;
  const spot = spotById(game, p.hidden);
  const at = centerOf(spot.approach);
  if (Math.hypot(at.x - s.x, at.y - s.y) <= RISK_NEAR * TILE) return true;
  return inView(game, at.x, at.y);
}

/** Name of the room the player is in. */
export function playerRoom(game: Game): string {
  const p = game.player;
  return roomNameAt(game, p.x, p.y);
}

/** A short status line about Peeka, shown on screen and read to screen readers. */
export function statusText(game: Game): string {
  const s = game.seeker;
  const p = game.player;
  switch (game.phase) {
    case "countdown":
      return `Peeka is counting… ${Math.max(1, Math.ceil(ROUND.headStart - game.phaseT))}! Find a hiding spot.`;
    case "won":
      return "You stayed hidden!";
    case "caught":
    case "over":
      return "The seeker found you!";
  }
  if (s.mode === "chase") return "Peeka spotted you! Run and hide!";
  if (s.mode === "suspicious")
    return s.clue?.kind === "sound"
      ? "Peeka heard something!"
      : "Peeka thinks it saw something…";
  if (s.inspecting) {
    const room = roomNameAt(game, s.x, s.y);
    return `Peeka is checking the ${spotById(game, s.inspecting.spot).name.replace(/^(Under|Behind) the /, "")} in the ${room}.`;
  }
  if (s.mode === "investigate") return "Peeka is looking into it…";
  if (p.hidden)
    return exitRisk(game) ? "Shh… Peeka is close!" : "You are hidden.";
  return "Stay hidden until time runs out!";
}

/** One friendly sentence about how the player was found. */
export function caughtHint(game: Game, reason: CaughtReason | null): string {
  if (!reason) return "";
  if (reason.kind === "seen")
    return `Peeka spotted you in the ${reason.room}. Keep out of the flashlight beam, and walk instead of running so Peeka doesn't hear you.`;
  const spot = spotById(game, reason.spot).name;
  if (reason.because === "sound")
    return reason.noise === "creak"
      ? `Peeka heard a creak and checked the ${spot}. Slip in when Peeka is far away.`
      : `Peeka heard you ${reason.noise === "bump" ? "bump into something" : "running"} and checked the ${spot}. Walk when Peeka is near!`;
  if (reason.because === "hide")
    return `Peeka saw you slip into the ${spot}. Hide when Peeka isn't looking your way.`;
  if (reason.because === "sight")
    return `Peeka caught a glimpse of you and checked the ${spot}.`;
  return `Peeka checked the ${spot}. Spots with a ✓ were checked recently: sneak into one when Peeka moves on!`;
}

/** Whether the player is (fully) hidden. */
export const isHidden = (game: Game) => !exposed(game);
