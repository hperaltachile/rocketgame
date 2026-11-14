/**
 * Astro Hop rules: a side-scrolling platformer, as plain TypeScript (no
 * Phaser or DOM) so it can be tested. `step` advances the game by one fixed
 * tick and pushes `events` that the scene turns into sounds and effects.
 * Everything is measured in art pixels; a tile is 16.
 */

import {
  ENEMY,
  FLOW,
  ITEM,
  KIT,
  MOVER,
  PHYS,
  POINTS,
  POLE_TILES,
  ROCKET_OFFSET,
  ROWS,
  SHELL,
  SPARK,
  STEP,
  TILE,
  TIMER,
  VIEW_W,
} from "./config";
import { LEVELS, type LevelDef } from "./levels";

// ---------------------------------------------------------------- types

export type Input = {
  left: boolean;
  right: boolean;
  jump: boolean;
  run: boolean;
};

export const NO_INPUT: Input = {
  left: false,
  right: false,
  jump: false,
  run: false,
};

export type Size = "small" | "big" | "fire";

export type Box = { x: number; y: number; w: number; h: number };

type Body = Box & { vx: number; vy: number; onGround: boolean };

export type Player = Body & {
  size: Size;
  facing: 1 | -1;
  /** Seconds of flashing left after a hit (enemies can't hurt Kit). */
  invulnerable: number;
  /** Size before the current grow/shrink, while the world is paused for it. */
  transformFrom: Size | null;
  jumpHeld: boolean;
  prevJump: boolean;
  prevRun: boolean;
  coyote: number;
  buffer: number;
  /** Stomps since Kit last touched the ground. */
  chain: number;
  /** Distance walked, for the walk animation. */
  walked: number;
  skidding: boolean;
  /** Moving platform Kit is standing on. */
  riding: number | null;
  /** Seconds since the last spark, for the throw pose. */
  throwing: number;
  visible: boolean;
};

export type EnemyKind = "grumble" | "shellbot" | "boing";
export type EnemyState = "walk" | "shell" | "spin" | "squashed" | "flipped";

export type Enemy = Body & {
  id: number;
  kind: EnemyKind;
  state: EnemyState;
  dir: 1 | -1;
  active: boolean;
  timer: number;
  /** Enemies a spinning shell has knocked out (for its points chain). */
  kills: number;
  grace: number;
};

export type ItemKind = "seed" | "berry" | "life";

export type Item = Body & {
  id: number;
  kind: ItemKind;
  dir: 1 | -1;
  /** Pixels still to rise out of its block. */
  rising: number;
};

export type Spark = Body & { id: number; dir: 1 | -1 };

export type Mover = Box & {
  id: number;
  kind: "h" | "v";
  x0: number;
  y0: number;
  dx: number;
  dy: number;
};

export type Bump = { col: number; row: number; t: number };

export type Phase = "intro" | "play" | "dying" | "goal" | "over" | "won";

export type GoalStage = "slide" | "walk" | "launch" | "done";

export type Goal = {
  /** x of the pole's centre, and its top and bottom. */
  poleX: number;
  poleTop: number;
  poleBottom: number;
  flagY: number;
  rocketX: number;
  rocketY: number;
  lift: number;
  stage: GoalStage;
};

export type GameEvent =
  | { type: "intro" }
  | { type: "jump" }
  | { type: "coin"; x: number; y: number; fromBlock: boolean }
  | { type: "stomp"; x: number; y: number }
  | { type: "kick"; x: number; y: number }
  | { type: "bump"; col: number; row: number }
  | { type: "thud" }
  | { type: "break"; col: number; row: number }
  | { type: "sprout"; kind: ItemKind }
  | { type: "powerUp"; size: Size }
  | { type: "hurt" }
  | { type: "life" }
  | { type: "spark" }
  | { type: "puff"; x: number; y: number }
  | { type: "flip"; x: number; y: number }
  | { type: "points"; x: number; y: number; value: number | "1UP" }
  | { type: "checkpoint" }
  | { type: "hurry" }
  | { type: "die" }
  | { type: "goal"; points: number }
  | { type: "launch" }
  | { type: "tally" }
  | { type: "clear" }
  | { type: "gameOver" }
  | { type: "win" };

export type Game = {
  /** The level list (the real one, or test levels). */
  levels: readonly LevelDef[];
  levelIndex: number;
  level: LevelDef;
  /** Goes up every time a level is (re)loaded, so the scene can rebuild. */
  serial: number;
  cols: number;
  grid: string[][];
  player: Player;
  enemies: Enemy[];
  items: Item[];
  sparks: Spark[];
  movers: Mover[];
  bumps: Bump[];
  camX: number;
  time: number;
  timeAcc: number;
  phase: Phase;
  phaseTime: number;
  /** World pause while Kit grows or shrinks. */
  freeze: number;
  score: number;
  coins: number;
  lives: number;
  checkpoint: { col: number; row: number } | null;
  reachedCheckpoint: boolean;
  goal: Goal;
  /** Seconds of play in this level (animations and moving platforms). */
  clock: number;
  events: GameEvent[];
  nextId: number;
};

// ---------------------------------------------------------------- tiles

const SOLID = new Set(["#", "X", "B", "?", "M", "U", "T", "F"]);
/** Tiles that are background once the level is loaded. */
const SPAWNS = new Set(["K", "g", "k", "f", "H", "V", "c"]);

export const isSolid = (ch: string) => SOLID.has(ch);

/** The tile at a cell; outside the level sides is solid, above and below is empty. */
export function tileAt(game: Game, col: number, row: number): string {
  if (col < 0 || col >= game.cols) return "#";
  if (row < 0 || row >= ROWS) return ".";
  return game.grid[row][col];
}

type Parsed = {
  grid: string[][];
  start: { col: number; row: number };
  checkpoint: { col: number; row: number } | null;
  flag: { col: number; row: number };
  enemies: { kind: EnemyKind; col: number; row: number }[];
  movers: { kind: "h" | "v"; col: number; row: number; len: number }[];
};

const ENEMY_CHARS: Record<string, EnemyKind> = {
  g: "grumble",
  k: "shellbot",
  f: "boing",
};

export function parseLevel(def: LevelDef): Parsed {
  const grid = def.rows.map((row) => row.split(""));
  let start = { col: 1, row: ROWS - 3 };
  let checkpoint: Parsed["checkpoint"] = null;
  let flag = { col: grid[0].length - 8, row: ROWS - 3 };
  const enemies: Parsed["enemies"] = [];
  const movers: Parsed["movers"] = [];
  grid.forEach((cells, row) => {
    for (let col = 0; col < cells.length; col++) {
      const ch = cells[col];
      if (ch === "K") start = { col, row };
      else if (ch === "c") checkpoint = { col, row };
      else if (ch === "F") flag = { col, row };
      else if (ENEMY_CHARS[ch])
        enemies.push({ kind: ENEMY_CHARS[ch], col, row });
      else if ((ch === "H" || ch === "V") && def.rows[row][col - 1] !== ch) {
        let len = 1;
        while (cells[col + len] === ch) len++;
        movers.push({ kind: ch === "H" ? "h" : "v", col, row, len });
      }
      if (SPAWNS.has(ch)) cells[col] = ".";
    }
  });
  return { grid, start, checkpoint, flag, enemies, movers };
}

// ---------------------------------------------------------------- setup

function newPlayer(size: Size): Player {
  const dims = size === "small" ? KIT.small : KIT.big;
  return {
    x: 0,
    y: 0,
    w: dims.w,
    h: dims.h,
    vx: 0,
    vy: 0,
    onGround: false,
    size,
    facing: 1,
    invulnerable: 0,
    transformFrom: null,
    jumpHeld: false,
    prevJump: true,
    prevRun: true,
    coyote: 0,
    buffer: 0,
    chain: 0,
    walked: 0,
    skidding: false,
    riding: null,
    throwing: 1,
    visible: true,
  };
}

/** A new game, starting at `levelIndex` with full lives and no score. */
export function newGame(
  levelIndex = 0,
  levels: readonly LevelDef[] = LEVELS,
): Game {
  const game = {
    levels,
    serial: 0,
    score: 0,
    coins: 0,
    lives: KIT.lives,
    nextId: 1,
    events: [],
    player: newPlayer("small"),
  } as unknown as Game;
  loadLevel(game, Math.max(0, Math.min(levels.length - 1, levelIndex)), false);
  return game;
}

/** (Re)starts a level, from its checkpoint if `fromCheckpoint`. */
export function loadLevel(game: Game, index: number, fromCheckpoint: boolean) {
  const level = game.levels[index];
  const parsed = parseLevel(level);
  const sameLevel = game.levelIndex === index && game.level !== undefined;
  game.levelIndex = index;
  game.level = level;
  game.serial++;
  game.grid = parsed.grid;
  game.cols = parsed.grid[0].length;
  game.checkpoint = parsed.checkpoint;
  if (!sameLevel || !fromCheckpoint) game.reachedCheckpoint = false;
  const spawn =
    fromCheckpoint && game.reachedCheckpoint && parsed.checkpoint
      ? parsed.checkpoint
      : parsed.start;

  const size = game.player?.size ?? "small";
  const p = newPlayer(size);
  p.x = spawn.col * TILE + (TILE - p.w) / 2;
  p.y = (spawn.row + 1) * TILE - p.h;
  game.player = p;

  game.enemies = parsed.enemies
    .filter((e) => spawn === parsed.start || e.col > spawn.col + 4)
    .map((e) => newEnemy(game, e.kind, e.col, e.row));
  game.items = [];
  game.sparks = [];
  game.bumps = [];
  game.movers = parsed.movers.map((m) => ({
    id: game.nextId++,
    kind: m.kind,
    x: m.col * TILE,
    y: m.row * TILE,
    x0: m.col * TILE,
    y0: m.row * TILE,
    w: m.len * TILE,
    h: MOVER.thickness,
    dx: 0,
    dy: 0,
  }));

  const poleBottom = parsed.flag.row * TILE;
  const poleTop = poleBottom - POLE_TILES * TILE;
  const rocketCol = parsed.flag.col + ROCKET_OFFSET;
  game.goal = {
    poleX: parsed.flag.col * TILE + TILE / 2,
    poleTop,
    poleBottom,
    flagY: poleTop + 6,
    rocketX: rocketCol * TILE + TILE / 2,
    rocketY: groundBelow(game, rocketCol, parsed.flag.row) * TILE,
    lift: 0,
    stage: "slide",
  };

  game.camX = clampCam(game, p.x + p.w / 2 - VIEW_W * 0.4);
  game.time = level.time;
  game.timeAcc = 0;
  game.phase = "intro";
  game.phaseTime = 0;
  game.freeze = 0;
  game.clock = 0;
  game.events.push({ type: "intro" });
}

/** First solid row at or below `row` in a column (or the bottom). */
function groundBelow(game: Game, col: number, row: number): number {
  for (let r = row; r < ROWS; r++) if (isSolid(tileAt(game, col, r))) return r;
  return ROWS;
}

function newEnemy(
  game: Game,
  kind: EnemyKind,
  col: number,
  row: number,
): Enemy {
  const w = 14;
  const h = kind === "shellbot" ? 16 : 14;
  return {
    id: game.nextId++,
    kind,
    state: "walk",
    x: col * TILE + (TILE - w) / 2,
    y: (row + 1) * TILE - h,
    w,
    h,
    vx: 0,
    vy: 0,
    onGround: false,
    dir: -1,
    active: false,
    timer: ENEMY.hopWait,
    kills: 0,
    grace: 0,
  };
}

function clampCam(game: Game, x: number): number {
  return Math.max(0, Math.min(x, game.cols * TILE - VIEW_W));
}

// ---------------------------------------------------------------- physics

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const approach = (v: number, target: number, amount: number) =>
  v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);

/** Moves a body sideways and stops it at walls. Returns true if it hit one. */
function moveX(game: Game, b: Body, dx: number): boolean {
  if (dx === 0) return false;
  b.x += dx;
  const top = Math.floor(b.y / TILE);
  const bottom = Math.floor((b.y + b.h - 0.01) / TILE);
  const col =
    dx > 0 ? Math.floor((b.x + b.w - 0.01) / TILE) : Math.floor(b.x / TILE);
  for (let row = top; row <= bottom; row++) {
    if (isSolid(tileAt(game, col, row))) {
      b.x = dx > 0 ? col * TILE - b.w : (col + 1) * TILE;
      return true;
    }
  }
  return false;
}

type YResult = {
  landed: boolean;
  /** The block Kit's head hit, if any. */
  head: { col: number; row: number } | null;
};

/**
 * Moves a body up or down, landing on solid tiles and the tops of bridges.
 * For Kit (`player`), hidden blocks stop him from below and small corner
 * clips are nudged aside.
 */
function moveY(game: Game, b: Body, dy: number, player = false): YResult {
  const result: YResult = { landed: false, head: null };
  if (dy === 0) return result;
  const prevTop = b.y;
  const prevBottom = b.y + b.h;
  b.y += dy;
  const left = Math.floor(b.x / TILE);
  const right = Math.floor((b.x + b.w - 0.01) / TILE);
  if (dy > 0) {
    const row = Math.floor((b.y + b.h - 0.01) / TILE);
    for (let col = left; col <= right; col++) {
      const ch = tileAt(game, col, row);
      if (isSolid(ch) || (ch === "_" && prevBottom <= row * TILE + 0.5)) {
        b.y = row * TILE - b.h;
        result.landed = true;
        return result;
      }
    }
    return result;
  }
  const row = Math.floor(b.y / TILE);
  const blocking: number[] = [];
  for (let col = left; col <= right; col++) {
    const ch = tileAt(game, col, row);
    if (
      isSolid(ch) ||
      (player && ch === "L" && prevTop >= (row + 1) * TILE - 0.01)
    ) {
      blocking.push(col);
    }
  }
  if (blocking.length === 0) return result;
  if (player && blocking.length === 1 && left !== right) {
    // Only one corner clips the block: slide past it if it's just a little.
    const col = blocking[0];
    const overlap =
      col === left ? (col + 1) * TILE - b.x : b.x + b.w - col * TILE;
    if (overlap <= PHYS.cornerNudge) {
      b.x = col === left ? (col + 1) * TILE : col * TILE - b.w;
      return result;
    }
  }
  b.y = (row + 1) * TILE;
  const center = Math.floor((b.x + b.w / 2) / TILE);
  result.head = {
    col: blocking.includes(center) ? center : blocking[0],
    row,
  };
  return result;
}

// ---------------------------------------------------------------- scoring

function addPoints(game: Game, value: number | "1UP", x: number, y: number) {
  if (value === "1UP") addLife(game);
  else game.score += value;
  game.events.push({ type: "points", x, y, value });
}

function addLife(game: Game) {
  game.lives++;
  game.events.push({ type: "life" });
}

function addCoin(game: Game, x: number, y: number, fromBlock: boolean) {
  game.coins++;
  game.score += POINTS.coin;
  game.events.push({ type: "coin", x, y, fromBlock });
  if (game.coins >= POINTS.coinsForLife) {
    game.coins -= POINTS.coinsForLife;
    addLife(game);
  }
}

/** Points for the n-th stomp in a row (0-based); past the end, an extra life. */
export function chainPoints(n: number): number | "1UP" {
  return n < POINTS.chain.length ? POINTS.chain[n] : "1UP";
}

/** Points for touching the beacon pole with Kit's feet at `feetY`. */
export function polePoints(goal: Goal, feetY: number): number {
  const share = (goal.poleBottom - feetY) / (goal.poleBottom - goal.poleTop);
  for (const [min, points] of POINTS.pole) if (share >= min) return points;
  return POINTS.pole[POINTS.pole.length - 1][1];
}

// ---------------------------------------------------------------- Kit

function setSize(game: Game, size: Size) {
  const p = game.player;
  const dims = size === "small" ? KIT.small : KIT.big;
  const feet = p.y + p.h;
  const center = p.x + p.w / 2;
  p.transformFrom = p.size;
  p.size = size;
  p.w = dims.w;
  p.h = dims.h;
  p.x = center - p.w / 2;
  p.y = feet - p.h;
  game.freeze = KIT.transform;
}

function hurt(game: Game) {
  const p = game.player;
  if (p.invulnerable > 0 || game.phase !== "play") return;
  if (p.size === "small") {
    die(game);
    return;
  }
  // Kind to kids: a Comet Berry hit only takes the berry away.
  setSize(game, p.size === "fire" ? "big" : "small");
  p.invulnerable = KIT.invulnerable;
  game.events.push({ type: "hurt" });
}

function die(game: Game) {
  if (game.phase !== "play") return;
  game.phase = "dying";
  game.phaseTime = 0;
  const p = game.player;
  p.vx = 0;
  p.vy = 0;
  game.events.push({ type: "die" });
}

function updatePlayer(game: Game, input: Input, dt: number) {
  const p = game.player;
  const jumpPressed = input.jump && !p.prevJump;
  const runPressed = input.run && !p.prevRun;
  p.prevJump = input.jump;
  p.prevRun = input.run;
  if (p.invulnerable > 0) p.invulnerable = Math.max(0, p.invulnerable - dt);
  p.throwing += dt;

  // Run left and right.
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const max = input.run ? PHYS.run : PHYS.walk;
  p.skidding = false;
  if (dir !== 0) {
    p.facing = dir as 1 | -1;
    if (p.vx * dir < 0) {
      p.vx += dir * (p.onGround ? PHYS.skid : PHYS.airAccel) * dt;
      p.skidding = p.onGround;
    } else if (Math.abs(p.vx) <= max) {
      const accel = p.onGround ? PHYS.accel : PHYS.airAccel;
      p.vx = approach(p.vx, dir * max, accel * dt);
    } else {
      p.vx = approach(p.vx, dir * max, PHYS.friction * dt);
    }
  } else {
    p.vx = approach(
      p.vx,
      0,
      (p.onGround ? PHYS.friction : PHYS.airFriction) * dt,
    );
  }

  // Jump, with a little forgiveness on both sides of a ledge.
  p.coyote = p.onGround ? PHYS.coyote : p.coyote - dt;
  p.buffer = jumpPressed ? PHYS.jumpBuffer : p.buffer - dt;
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -(PHYS.jump + Math.abs(p.vx) * PHYS.jumpRunBonus);
    p.buffer = 0;
    p.coyote = 0;
    p.onGround = false;
    p.riding = null;
    p.jumpHeld = true;
    game.events.push({ type: "jump" });
  }
  if (!input.jump) p.jumpHeld = false;
  const gravity = p.vy < 0 && p.jumpHeld ? PHYS.gravityHold : PHYS.gravity;
  p.vy = Math.min(p.vy + gravity * dt, PHYS.maxFall);

  // Comet Berry sparks.
  if (runPressed && p.size === "fire" && game.sparks.length < SPARK.max) {
    game.sparks.push({
      id: game.nextId++,
      x: p.facing > 0 ? p.x + p.w : p.x - 6,
      y: p.y + 6,
      w: 6,
      h: 6,
      vx: 0,
      vy: 40,
      onGround: false,
      dir: p.facing,
    });
    p.throwing = 0;
    game.events.push({ type: "spark" });
  }

  // Ride moving platforms.
  const ride = game.movers.find((m) => m.id === p.riding);
  if (ride) {
    moveX(game, p, ride.dx);
    p.y += ride.dy;
  }

  if (moveX(game, p, p.vx * dt)) p.vx = 0;
  if (p.x < game.camX) {
    p.x = game.camX;
    if (p.vx < 0) p.vx = 0;
  }

  const prevBottom = p.y + p.h;
  const result = moveY(game, p, p.vy * dt, true);
  p.onGround = result.landed;
  p.riding = null;
  if (result.landed) p.vy = 0;
  if (result.head) {
    p.vy = 0;
    p.jumpHeld = false;
    hitBlock(game, result.head.col, result.head.row);
  }
  for (const m of game.movers) {
    if (
      p.vy >= 0 &&
      p.x + p.w > m.x &&
      p.x < m.x + m.w &&
      prevBottom <= m.y - m.dy + 1 &&
      p.y + p.h >= m.y
    ) {
      p.y = m.y - p.h;
      p.vy = 0;
      p.onGround = true;
      p.riding = m.id;
    }
  }
  if (p.onGround) p.chain = 0;
  if (p.onGround) p.walked += Math.abs(p.vx) * dt;

  if (p.y > ROWS * TILE + 8) die(game);
}

/** Kit's head bumps the block at (col, row) from below. */
function hitBlock(game: Game, col: number, row: number) {
  const ch = game.grid[row][col];
  const x = col * TILE + TILE / 2;
  const y = row * TILE;
  const bump = () => {
    game.bumps.push({ col, row, t: 0.15 });
    game.events.push({ type: "bump", col, row });
    knockFromBelow(game, col, row);
  };
  switch (ch) {
    case "?":
      game.grid[row][col] = "U";
      bump();
      addCoin(game, x, y, true);
      game.events.push({ type: "points", x, y: y - 16, value: POINTS.coin });
      break;
    case "M":
    case "L": {
      game.grid[row][col] = "U";
      bump();
      const kind: ItemKind =
        ch === "L" ? "life" : game.player.size === "small" ? "seed" : "berry";
      game.items.push({
        id: game.nextId++,
        kind,
        x: col * TILE + 1,
        y: row * TILE,
        w: 14,
        h: 14,
        vx: 0,
        vy: 0,
        onGround: false,
        dir: 1,
        rising: ITEM.rise,
      });
      game.events.push({ type: "sprout", kind });
      break;
    }
    case "B":
      if (game.player.size === "small") {
        bump();
      } else {
        game.grid[row][col] = ".";
        knockFromBelow(game, col, row);
        game.score += POINTS.brick;
        game.events.push({ type: "break", col, row });
      }
      break;
    default:
      game.events.push({ type: "thud" });
  }
}

/** Anything standing on a bumped block gets knocked: enemies flip, coins pop. */
function knockFromBelow(game: Game, col: number, row: number) {
  const top: Box = { x: col * TILE, y: row * TILE - 2, w: TILE, h: 4 };
  for (const e of game.enemies) {
    if (e.state !== "flipped" && e.state !== "squashed" && overlaps(e, top)) {
      flipEnemy(game, e, e.x + e.w / 2 < col * TILE + TILE / 2 ? -1 : 1);
      addPoints(game, POINTS.chain[0], e.x + e.w / 2, e.y);
    }
  }
  for (const it of game.items) {
    if (it.rising <= 0 && overlaps(it, top)) {
      it.vy = -180;
      it.dir = it.x + it.w / 2 < col * TILE + TILE / 2 ? -1 : 1;
    }
  }
  if (row > 0 && game.grid[row - 1][col] === "C") {
    game.grid[row - 1][col] = ".";
    addCoin(game, col * TILE + TILE / 2, (row - 1) * TILE, true);
  }
}

// ---------------------------------------------------------------- enemies

function flipEnemy(game: Game, e: Enemy, dir: 1 | -1) {
  e.state = "flipped";
  e.vy = -ENEMY.flipJump;
  e.vx = dir * 40;
  game.events.push({ type: "flip", x: e.x + e.w / 2, y: e.y });
}

function toShell(e: Enemy) {
  const feet = e.y + e.h;
  e.state = "shell";
  e.h = 12;
  e.y = feet - e.h;
  e.vx = 0;
  e.timer = SHELL.wake;
  e.kills = 0;
}

function kickShell(game: Game, e: Enemy, dir: 1 | -1) {
  e.state = "spin";
  e.dir = dir;
  e.grace = SHELL.grace;
  e.kills = 0;
  addPoints(game, POINTS.kick, e.x + e.w / 2, e.y);
  game.events.push({ type: "kick", x: e.x + e.w / 2, y: e.y });
}

/** Whether there's floor under the point (x, feet). */
function floorAt(game: Game, x: number, feet: number): boolean {
  const ch = tileAt(game, Math.floor(x / TILE), Math.floor((feet + 1) / TILE));
  return isSolid(ch) || ch === "_";
}

/** Whether there's floor just ahead of an enemy's leading foot. */
function floorAhead(game: Game, e: Enemy): boolean {
  return floorAt(game, e.dir > 0 ? e.x + e.w + 1 : e.x - 1, e.y + e.h);
}

function updateEnemies(game: Game, dt: number) {
  const wakeX = game.camX + VIEW_W + ENEMY.wakeMargin;
  for (const e of game.enemies) {
    if (!e.active) {
      if (e.x < wakeX) e.active = true;
      else continue;
    }
    if (e.grace > 0) e.grace -= dt;
    if (e.state === "squashed") {
      e.timer -= dt;
      continue;
    }
    if (e.state === "flipped") {
      e.vy = Math.min(e.vy + PHYS.gravity * dt, PHYS.maxFall);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      continue;
    }
    if (e.state === "shell") {
      e.timer -= dt;
      if (e.timer <= 0) {
        const feet = e.y + e.h;
        e.state = "walk";
        e.h = 16;
        e.y = feet - e.h;
      }
    }
    if (e.state === "walk") {
      if (e.kind === "boing") {
        if (e.onGround) {
          e.vx = 0;
          e.timer -= dt;
          if (e.timer <= 0) {
            // Stay on the platform: turn back if the hop would miss it.
            if (!floorAt(game, e.x + e.w / 2 + e.dir * TILE * 1.5, e.y + e.h))
              e.dir = -e.dir as 1 | -1;
            e.vy = -ENEMY.hopJump;
            e.vx = e.dir * ENEMY.hopSpeed;
            e.timer = ENEMY.hopWait;
          }
        }
      } else {
        e.vx = e.dir * ENEMY.speed;
      }
    } else if (e.state === "spin") {
      e.vx = e.dir * SHELL.speed;
    } else {
      e.vx = 0;
    }
    if (
      e.kind === "shellbot" &&
      e.state === "walk" &&
      e.onGround &&
      !floorAhead(game, e)
    ) {
      e.dir = -e.dir as 1 | -1;
      e.vx = -e.vx;
    }
    e.vy = Math.min(e.vy + PHYS.gravity * dt, PHYS.maxFall);
    if (moveX(game, e, e.vx * dt)) {
      e.dir = -e.dir as 1 | -1;
      if (e.state === "spin") game.events.push({ type: "thud" });
    }
    const result = moveY(game, e, e.vy * dt);
    e.onGround = result.landed;
    if (result.landed || result.head) e.vy = 0;
  }

  // Walkers turn when they meet; spinning shells knock others out.
  const alive = game.enemies.filter(
    (e) =>
      e.active &&
      (e.state === "walk" || e.state === "spin" || e.state === "shell"),
  );
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i];
      const b = alive[j];
      if (!overlaps(a, b) || a.state === "flipped" || b.state === "flipped")
        continue;
      if (a.state === "spin" || b.state === "spin") {
        const [shell, other] = a.state === "spin" ? [a, b] : [b, a];
        if (other.state === "spin") {
          flipEnemy(game, a, -1);
          flipEnemy(game, b, 1);
          continue;
        }
        flipEnemy(game, other, shell.dir);
        const value =
          POINTS.shellChain[
            Math.min(shell.kills, POINTS.shellChain.length - 1)
          ];
        shell.kills++;
        addPoints(game, value, other.x + other.w / 2, other.y);
      } else if (a.state === "walk" && b.state === "walk") {
        a.dir = a.x < b.x ? -1 : 1;
        b.dir = -a.dir as 1 | -1;
      }
    }
  }

  game.enemies = game.enemies.filter(
    (e) =>
      !(e.state === "squashed" && e.timer <= 0) &&
      e.y < ROWS * TILE + 32 &&
      e.x + e.w > game.camX - 64,
  );
}

function touchEnemies(game: Game, input: Input) {
  const p = game.player;
  for (const e of game.enemies) {
    if (!e.active || e.state === "squashed" || e.state === "flipped") continue;
    if (!overlaps(p, e)) continue;
    const stomp = p.vy > 0 && p.y + p.h <= e.y + e.h * 0.6;
    const cx = e.x + e.w / 2;
    if (stomp) {
      const value = chainPoints(p.chain);
      p.chain++;
      if (e.kind === "shellbot" && e.state === "shell") {
        kickShell(game, e, p.x + p.w / 2 < cx ? 1 : -1);
      } else {
        if (e.kind === "shellbot") {
          toShell(e);
        } else {
          e.state = "squashed";
          e.timer = ENEMY.squashed;
        }
        addPoints(game, value, cx, e.y);
        game.events.push({ type: "stomp", x: cx, y: e.y });
      }
      p.y = e.y - p.h;
      p.vy = -(input.jump ? PHYS.stompBounceHeld : PHYS.stompBounce);
      p.jumpHeld = input.jump;
      continue;
    }
    if (e.state === "shell") {
      kickShell(game, e, p.x + p.w / 2 < cx ? 1 : -1);
      continue;
    }
    if (e.state === "spin" && e.grace > 0) continue;
    hurt(game);
  }
}

// ---------------------------------------------------------------- items and sparks

function updateItems(game: Game, dt: number) {
  const p = game.player;
  for (const it of game.items) {
    if (it.rising > 0) {
      const d = Math.min(it.rising, ITEM.riseSpeed * dt);
      it.y -= d;
      it.rising -= d;
      if (it.rising <= 0) {
        it.vx =
          it.kind === "seed"
            ? ITEM.seedSpeed
            : it.kind === "life"
              ? ITEM.lifeSpeed
              : 0;
      }
      continue;
    }
    const speed =
      it.kind === "seed"
        ? ITEM.seedSpeed
        : it.kind === "life"
          ? ITEM.lifeSpeed
          : 0;
    it.vy = Math.min(it.vy + PHYS.gravity * dt, PHYS.maxFall);
    if (moveX(game, it, it.dir * speed * dt)) it.dir = -it.dir as 1 | -1;
    const result = moveY(game, it, it.vy * dt);
    if (result.landed || result.head) it.vy = 0;
  }
  game.items = game.items.filter((it) => {
    if (it.y > ROWS * TILE + 16) return false;
    if (it.rising > ITEM.rise / 2 || !overlaps(p, it)) return true;
    const x = it.x + it.w / 2;
    if (it.kind === "life") {
      addPoints(game, "1UP", x, it.y);
    } else {
      addPoints(game, POINTS.powerUp, x, it.y);
      const next: Size =
        it.kind === "seed" ? (p.size === "small" ? "big" : p.size) : "fire";
      if (next !== p.size) setSize(game, next);
      game.events.push({ type: "powerUp", size: next });
    }
    return false;
  });
}

function updateSparks(game: Game, dt: number) {
  game.sparks = game.sparks.filter((s) => {
    s.vy = Math.min(s.vy + SPARK.gravity * dt, PHYS.maxFall);
    if (moveX(game, s, s.dir * SPARK.speed * dt)) {
      game.events.push({ type: "puff", x: s.x + 3, y: s.y + 3 });
      return false;
    }
    const result = moveY(game, s, s.vy * dt);
    if (result.landed) s.vy = -SPARK.bounce;
    if (result.head) s.vy = 0;
    if (
      s.y > ROWS * TILE ||
      s.x > game.camX + VIEW_W + 16 ||
      s.x < game.camX - 16
    ) {
      return false;
    }
    for (const e of game.enemies) {
      if (!e.active || e.state === "flipped" || e.state === "squashed")
        continue;
      if (overlaps(s, e)) {
        flipEnemy(game, e, s.dir);
        addPoints(game, POINTS.spark, e.x + e.w / 2, e.y);
        game.events.push({ type: "puff", x: s.x + 3, y: s.y + 3 });
        return false;
      }
    }
    return true;
  });
}

function updateMovers(game: Game) {
  for (const m of game.movers) {
    const t = (1 - Math.cos((game.clock / MOVER.period) * Math.PI * 2)) / 2;
    const offset = t * MOVER.range * TILE;
    const x = m.kind === "h" ? m.x0 + offset : m.x0;
    const y = m.kind === "v" ? m.y0 - offset : m.y0;
    m.dx = x - m.x;
    m.dy = y - m.y;
    m.x = x;
    m.y = y;
  }
}

function collectCoins(game: Game) {
  const p = game.player;
  const left = Math.floor(p.x / TILE);
  const right = Math.floor((p.x + p.w - 0.01) / TILE);
  const top = Math.floor(p.y / TILE);
  const bottom = Math.floor((p.y + p.h - 0.01) / TILE);
  for (let row = Math.max(0, top); row <= Math.min(ROWS - 1, bottom); row++) {
    for (let col = left; col <= right; col++) {
      if (tileAt(game, col, row) === "C") {
        game.grid[row][col] = ".";
        addCoin(game, col * TILE + TILE / 2, row * TILE + TILE / 2, false);
      }
    }
  }
}

// ---------------------------------------------------------------- flow

function enterGoal(game: Game) {
  const p = game.player;
  const g = game.goal;
  const points = polePoints(g, p.y + p.h);
  game.phase = "goal";
  game.phaseTime = 0;
  g.stage = "slide";
  p.x = g.poleX - p.w - 1;
  p.vx = 0;
  p.vy = 0;
  p.facing = 1;
  p.y = Math.max(p.y, g.poleTop);
  addPoints(game, points, g.poleX, p.y);
  game.events.push({ type: "goal", points });
}

function updateGoal(game: Game, dt: number) {
  const p = game.player;
  const g = game.goal;
  if (g.stage === "slide") {
    const bottom = g.poleBottom - p.h;
    p.y = Math.min(bottom, p.y + FLOW.slide * dt);
    g.flagY = Math.min(g.poleBottom - 16, g.flagY + FLOW.slide * dt);
    if (p.y >= bottom && g.flagY >= g.poleBottom - 16 && game.phaseTime > 0.6) {
      g.stage = "walk";
      p.x = g.poleX + TILE / 2 + 1;
      p.y = g.poleBottom - p.h;
    }
    return;
  }
  if (g.stage === "walk") {
    p.vx = FLOW.walkToRocket;
    p.vy = Math.min(p.vy + PHYS.gravity * dt, PHYS.maxFall);
    moveX(game, p, p.vx * dt);
    const result = moveY(game, p, p.vy * dt);
    p.onGround = result.landed;
    if (result.landed) p.vy = 0;
    p.walked += p.vx * dt;
    if (p.x + p.w / 2 >= g.rocketX) {
      p.visible = false;
      p.vx = 0;
      g.stage = "launch";
      game.phaseTime = 0;
      game.events.push({ type: "launch" });
    }
    return;
  }
  if (g.stage === "launch") {
    if (game.phaseTime > 0.4) g.lift += (40 + g.lift * 3) * dt;
    // Count the clock into points, a few ticks a frame.
    for (let i = 0; i < 2 && game.time > 0; i++) {
      game.time--;
      game.score += POINTS.timeTick;
      if (game.time % 4 === 0) game.events.push({ type: "tally" });
    }
    if (game.time <= 0 && g.lift > 300) {
      g.stage = "done";
      game.phaseTime = 0;
      game.events.push({ type: "clear" });
    }
    return;
  }
  if (game.phaseTime >= FLOW.clear) {
    if (game.levelIndex + 1 >= game.levels.length) {
      game.phase = "won";
      game.events.push({ type: "win" });
    } else {
      loadLevel(game, game.levelIndex + 1, false);
    }
  }
}

function updateDying(game: Game, dt: number) {
  const p = game.player;
  if (game.phaseTime >= 0.5) {
    if (p.vy === 0 && game.phaseTime - dt < 0.5) p.vy = -260;
    p.vy = Math.min(p.vy + 900 * dt, 400);
    p.y += p.vy * dt;
  }
  if (game.phaseTime >= FLOW.dying) {
    game.lives--;
    if (game.lives <= 0) {
      game.phase = "over";
      game.events.push({ type: "gameOver" });
      return;
    }
    game.player.size = "small";
    loadLevel(game, game.levelIndex, true);
  }
}

/** Advances the game by one fixed tick. */
export function step(game: Game, input: Input, dt = STEP) {
  game.phaseTime += dt;
  for (const b of game.bumps) b.t -= dt;
  game.bumps = game.bumps.filter((b) => b.t > 0);

  switch (game.phase) {
    case "intro":
      if (game.phaseTime >= FLOW.intro) {
        game.phase = "play";
        game.phaseTime = 0;
        // Don't count a jump that was held through the intro card.
        game.player.prevJump = input.jump;
        game.player.prevRun = input.run;
      }
      return;
    case "dying":
      updateDying(game, dt);
      return;
    case "goal": {
      game.clock += dt;
      updateMovers(game);
      updateGoal(game, dt);
      const p = game.player;
      game.camX = Math.max(
        game.camX,
        clampCam(game, p.x + p.w / 2 - VIEW_W * 0.4),
      );
      return;
    }
    case "over":
    case "won":
      return;
  }

  if (game.freeze > 0) {
    game.freeze -= dt;
    if (game.freeze <= 0) game.player.transformFrom = null;
    return;
  }

  game.clock += dt;
  game.timeAcc += dt;
  while (game.timeAcc >= TIMER.unit) {
    game.timeAcc -= TIMER.unit;
    game.time--;
    if (game.time === TIMER.hurry) game.events.push({ type: "hurry" });
    if (game.time <= 0) {
      game.time = 0;
      die(game);
      return;
    }
  }

  updateMovers(game);
  updatePlayer(game, input, dt);
  if (game.phase !== "play") return;
  updateEnemies(game, dt);
  updateItems(game, dt);
  updateSparks(game, dt);
  touchEnemies(game, input);
  if (game.phase !== "play") return;
  collectCoins(game);

  const p = game.player;
  if (
    game.checkpoint &&
    !game.reachedCheckpoint &&
    p.x >= game.checkpoint.col * TILE
  ) {
    game.reachedCheckpoint = true;
    game.events.push({ type: "checkpoint" });
  }
  // The pole stands on a block: touching the block or the pole counts.
  if (p.x + p.w >= game.goal.poleX - TILE / 2 - 1) {
    enterGoal(game);
  }

  game.camX = Math.max(game.camX, clampCam(game, p.x + p.w / 2 - VIEW_W * 0.4));
}

/** World label for the HUD, e.g. "1-2". */
export const worldLabel = (game: Game) => game.level.id;

/** Saved "furthest level reached" (an index), repaired if missing or odd. */
export function parseUnlocked(
  raw: string | null,
  count = LEVELS.length,
): number {
  try {
    const value: unknown = raw === null ? 0 : JSON.parse(raw);
    return typeof value === "number" && Number.isInteger(value)
      ? Math.max(0, Math.min(count - 1, value))
      : 0;
  } catch {
    return 0;
  }
}
