/**
 * Game state for Hide & Seek: Mazes, plus the small helpers the player and
 * seeker code share. Pure: no Phaser, React or DOM; `rng` is injectable.
 */

import { shuffle, type Rng } from "../rng";
import { ROUND, seekerTuning, TILE, type SeekerTuning } from "./config";
import { roomAt, type Room } from "./house";
import { HOUSES } from "./houses";
import {
  centerOf,
  gridFor,
  isSolid,
  lineOfSight,
  type Grid,
  type Point,
  type Tile,
} from "./nav";

export type Dir4 = "up" | "down" | "left" | "right";

export type Input = {
  /** Movement, each axis -1..1 (a thumb stick can give less than 1). */
  x: number;
  y: number;
  run: boolean;
};

export const NO_INPUT: Input = { x: 0, y: 0, run: false };

export type Phase = "countdown" | "play" | "won" | "caught" | "over";

export type SeekerMode =
  "count" | "patrol" | "suspicious" | "investigate" | "search" | "chase";

export type NoiseKind = "run" | "bump" | "creak";

export type Clue = {
  kind: "sound" | "sight" | "hide";
  x: number;
  y: number;
  /** Game clock when it happened. */
  at: number;
  noise?: NoiseKind;
  /** For "hide": Peeka saw you slip into this spot. */
  spot?: string;
};

export type Transition = { kind: "enter" | "exit"; spot: string; t: number };

export type Player = {
  x: number;
  y: number;
  facing: Dir4;
  moving: boolean;
  running: boolean;
  /** Id of the spot you're hidden in. */
  hidden: string | null;
  trans: Transition | null;
  stepT: number;
  bumpT: number;
  /** Seconds since the last move (for the idle pose). */
  walkT: number;
};

export type Seeker = {
  x: number;
  y: number;
  /** Facing, radians (0 = right, π/2 = down). */
  angle: number;
  mode: SeekerMode;
  /** Points to walk to, in order (tile centres, smoothed as Peeka walks). */
  path: Point[];
  /** The tile Peeka was on last step (for doorway pauses). */
  tile: string;
  /** Standing still (doorway pause, reaction) for this long. */
  wait: number;
  /** Sweeping the flashlight around for this long. */
  look: number;
  /** 0..1: how sure Peeka is it saw you. */
  glimpse: number;
  /** Seeing you right now. */
  sees: boolean;
  lastSeen: { x: number; y: number } | null;
  clue: Clue | null;
  /** Spots still to check, in order. */
  queue: string[];
  /** The spot being opened right now and the seconds spent on it. */
  inspecting: { spot: string; t: number } | null;
  /** Rooms still to visit on this patrol lap. */
  rooms: string[];
  /** Room being searched (patrol) or null (clue search). */
  room: string | null;
  /** Game clock when each spot was last checked. */
  checked: Record<string, number>;
  /** Why Peeka is searching: what found the player, for the defeat hint. */
  reason: Clue["kind"] | "patrol";
  /** Seconds left before re-planning the chase path. */
  replan: number;
  /** Time since the last footstep event. */
  stepT: number;
};

export type CaughtReason =
  | { kind: "seen"; room: string }
  | {
      kind: "checked";
      spot: string;
      because: Clue["kind"] | "patrol";
      noise?: NoiseKind;
    };

export type GameEvent =
  | { type: "countdown"; n: number }
  | { type: "go" }
  | { type: "step"; running: boolean }
  | { type: "bump" }
  | { type: "hide"; spot: string }
  | { type: "hidden"; spot: string }
  | { type: "exit"; spot: string; risky: boolean }
  | { type: "noise"; x: number; y: number; radius: number; kind: NoiseKind }
  | { type: "heard"; x: number; y: number }
  | { type: "suspicious" }
  | { type: "chase" }
  | { type: "lost" }
  | { type: "seekerStep" }
  | { type: "inspect"; spot: string }
  | { type: "checked"; spot: string }
  | { type: "closeCall" }
  | { type: "tick"; seconds: number }
  | { type: "won"; round: number }
  | { type: "caught"; reason: CaughtReason }
  | { type: "over" };

export type Game = {
  rng: Rng;
  grid: Grid;
  phase: Phase;
  /** Seconds in the current phase. */
  phaseT: number;
  /** 1-based round number. */
  round: number;
  roundsWon: number;
  /** Seconds since the game started (memory and clue ages use it). */
  clock: number;
  /** Seconds left on the round timer. */
  time: number;
  /** Whole seconds already scored this round. */
  counted: number;
  score: number;
  tuning: SeekerTuning;
  player: Player;
  seeker: Seeker;
  /** How often you hid in each spot this game (Peeka learns from it). */
  hideCounts: Record<string, number>;
  /** Index into HOUSES of the first round's house. */
  firstHouse: number;
  /** Close call armed: Peeka came near your spot. */
  closeArmed: boolean;
  closeCalls: number;
  caught: CaughtReason | null;
  /** Events since the scene last read them. */
  events: GameEvent[];
};

/** Which house a round is played in: the first one picked, then the next, and around. */
export const houseIndex = (firstHouse: number, round: number) =>
  (firstHouse + round - 1) % HOUSES.length;

export function newGame(rng: Rng = Math.random, firstHouse = 0): Game {
  const game = {
    rng,
    firstHouse: ((firstHouse % HOUSES.length) + HOUSES.length) % HOUSES.length,
    grid: gridFor(firstHouse),
    phase: "countdown",
    phaseT: 0,
    round: 1,
    roundsWon: 0,
    clock: 0,
    time: ROUND.duration,
    counted: 0,
    score: 0,
    tuning: seekerTuning(0),
    hideCounts: {},
    closeArmed: false,
    closeCalls: 0,
    caught: null,
    events: [],
  } as unknown as Game;
  resetRound(game);
  return game;
}

/** Puts everyone back at the start for the next round (score and learning stay). */
export function resetRound(game: Game) {
  game.grid = gridFor(houseIndex(game.firstHouse, game.round));
  const house = game.grid.house;
  const p = centerOf(house.playerStart);
  const s = centerOf(house.seekerStart);
  game.phase = "countdown";
  game.phaseT = 0;
  game.time = ROUND.duration;
  game.counted = 0;
  game.tuning = seekerTuning(game.roundsWon);
  game.closeArmed = false;
  game.caught = null;
  game.player = {
    x: p.x,
    y: p.y,
    facing: "down",
    moving: false,
    running: false,
    hidden: null,
    trans: null,
    stepT: 0,
    bumpT: 0,
    walkT: 0,
  };
  game.seeker = {
    x: s.x,
    y: s.y,
    angle: -Math.PI / 2,
    mode: "count",
    path: [],
    tile: "",
    wait: 0,
    look: 0,
    glimpse: 0,
    sees: false,
    lastSeen: null,
    clue: null,
    queue: [],
    inspecting: null,
    rooms: [],
    room: null,
    checked: {},
    reason: "patrol",
    replan: 0,
    stepT: 0,
  };
}

export function spotById(game: Game, id: string) {
  return game.grid.spots.find((s) => s.id === id)!;
}

export function roomById(game: Game, id: string): Room {
  return game.grid.house.rooms.find((r) => r.id === id)!;
}

/** The room name at a point (art px). */
export function roomNameAt(game: Game, x: number, y: number): string {
  return roomAt(game.grid.house, Math.floor(x / TILE), Math.floor(y / TILE))
    .name;
}

/** Peeka learns hiding habits by kind of furniture ("always the wardrobe!"), across houses. */
export const habitKey = (game: Game, spotId: string) =>
  spotById(game, spotId).furniture.kind;

/** Peeka checked this spot recently and still remembers it was empty. */
export function remembered(game: Game, id: string): boolean {
  const at = game.seeker.checked[id];
  return at !== undefined && game.clock - at < game.tuning.memory;
}

/** Whether the player can be seen at all (not tucked away in a spot). */
export function exposed(game: Game): boolean {
  const p = game.player;
  if (p.hidden && !p.trans) return false;
  // Halfway into a spot you're out of sight; halfway out you're visible.
  if (p.trans?.kind === "enter" && p.trans.t > 0.5) return false;
  return true;
}

/** Whether Peeka's flashlight covers a point right now. */
export function inView(game: Game, x: number, y: number): boolean {
  const s = game.seeker;
  if (s.mode === "count") return false;
  const dx = x - s.x;
  const dy = y - s.y;
  const d = Math.hypot(dx, dy);
  if (d > game.tuning.range * TILE) return false;
  if (d > TILE * 0.9) {
    const diff = Math.abs(angleDiff(Math.atan2(dy, dx), s.angle));
    if (diff > (game.tuning.fov * Math.PI) / 360) return false;
  }
  return lineOfSight(game.grid, s.x, s.y, x, y);
}

/** Signed smallest difference a − b, in −π..π. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function emit(game: Game, event: GameEvent) {
  game.events.push(event);
}

/** Peeka found the player: the round (and the game) ends. Fires once. */
export function catchPlayer(game: Game, reason: CaughtReason) {
  if (game.phase !== "play") return;
  game.phase = "caught";
  game.phaseT = 0;
  game.caught = reason;
  game.seeker.path = [];
  emit(game, { type: "caught", reason });
}

/** A fresh shuffled patrol lap of every room. */
export function patrolLap(game: Game, skip?: string): string[] {
  const rooms = shuffle(
    game.grid.house.rooms.map((r) => r.id).filter((id) => id !== skip),
    game.rng,
  );
  return rooms;
}

/** The walkable tile nearest a room's middle (Peeka's waypoint for the room). */
export function roomWaypoint(game: Game, id: string): Tile {
  const room = roomById(game, id);
  const house = game.grid.house;
  const cx = room.col + (room.w - 1) / 2;
  const cy = room.row + (room.h - 1) / 2;
  let best: Tile = [room.col, room.row];
  let bestD = Infinity;
  for (let r = room.row; r < room.row + room.h; r++) {
    for (let c = room.col; c < room.col + room.w; c++) {
      if (isSolid(game.grid, c, r) || roomAt(house, c, r).id !== id) continue;
      const d = (c - cx) ** 2 + (r - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = [c, r];
      }
    }
  }
  return best;
}
