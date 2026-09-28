/** Pure 2048 rules: no React, no DOM. `rng` is injectable for tests. */

export type Direction = "up" | "down" | "left" | "right";

export type Tile = {
  id: number;
  value: number;
  row: number;
  col: number;
  /**
   * "new": spawned this turn. "merged": created by a merge this turn.
   * "moved": carried over. "consumed": merged away this turn; kept for one
   * render so it can slide into place under the merged tile, then dropped.
   */
  kind: "new" | "merged" | "moved" | "consumed";
};

export type Game = {
  size: number;
  tiles: Tile[];
  score: number;
  nextId: number;
  /** True once a 2048 tile has been made (the player may keep going). */
  won: boolean;
  over: boolean;
};

export type Rng = () => number;

export const WIN_VALUE = 2048;

/**
 * Slides one line toward index 0 and merges equal neighbours once per move.
 * [2,2,2,2] -> [4,4,0,0]; [4,4,8,0] -> [8,8,0,0] (the new 8 does not merge again).
 */
export function slideLine(line: number[]): { line: number[]; gained: number } {
  const values = line.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < values.length && values[i] === values[i + 1]) {
      const merged = values[i] * 2;
      out.push(merged);
      gained += merged;
      i++;
    } else {
      out.push(values[i]);
    }
  }
  while (out.length < line.length) out.push(0);
  return { line: out, gained };
}

function activeTiles(tiles: Tile[]): Tile[] {
  return tiles.filter((t) => t.kind !== "consumed");
}

/** Board as rows of values, 0 = empty. */
export function toGrid(game: Pick<Game, "size" | "tiles">): number[][] {
  const grid = Array.from({ length: game.size }, () =>
    Array<number>(game.size).fill(0),
  );
  for (const t of activeTiles(game.tiles)) grid[t.row][t.col] = t.value;
  return grid;
}

/** Cell coordinates of each line, ordered from the edge tiles slide toward. */
function lines(size: number, dir: Direction): [number, number][][] {
  const result: [number, number][][] = [];
  for (let a = 0; a < size; a++) {
    const line: [number, number][] = [];
    for (let b = 0; b < size; b++) {
      const k = dir === "left" || dir === "up" ? b : size - 1 - b;
      line.push(dir === "left" || dir === "right" ? [a, k] : [k, a]);
    }
    result.push(line);
  }
  return result;
}

function spawn(game: Game, rng: Rng): Game {
  const grid = toGrid(game);
  const empty: [number, number][] = [];
  grid.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v === 0) empty.push([r, c]);
    }),
  );
  if (empty.length === 0) return game;
  const [row, col] = empty[Math.floor(rng() * empty.length)];
  const value = rng() < 0.9 ? 2 : 4;
  return {
    ...game,
    tiles: [...game.tiles, { id: game.nextId, value, row, col, kind: "new" }],
    nextId: game.nextId + 1,
  };
}

export function canMove(game: Pick<Game, "size" | "tiles">): boolean {
  const grid = toGrid(game);
  for (let r = 0; r < game.size; r++) {
    for (let c = 0; c < game.size; c++) {
      const v = grid[r][c];
      if (v === 0) return true;
      if (c + 1 < game.size && grid[r][c + 1] === v) return true;
      if (r + 1 < game.size && grid[r + 1][c] === v) return true;
    }
  }
  return false;
}

export function newGame(rng: Rng = Math.random, size = 4): Game {
  const empty: Game = {
    size,
    tiles: [],
    score: 0,
    nextId: 1,
    won: false,
    over: false,
  };
  return spawn(spawn(empty, rng), rng);
}

/** Returns the same object when nothing can move in that direction. */
export function move(game: Game, dir: Direction, rng: Rng = Math.random): Game {
  if (game.over) return game;

  const byCell = new Map<string, Tile>();
  for (const t of activeTiles(game.tiles)) byCell.set(`${t.row},${t.col}`, t);

  const tiles: Tile[] = [];
  let nextId = game.nextId;
  let gained = 0;
  let changed = false;
  let won = game.won;

  for (const line of lines(game.size, dir)) {
    const inLine = line
      .map(([r, c]) => byCell.get(`${r},${c}`))
      .filter((t): t is Tile => t !== undefined);

    let slot = 0;
    for (let i = 0; i < inLine.length; i++) {
      const [row, col] = line[slot];
      const a = inLine[i];
      const b = inLine[i + 1];
      if (b && a.value === b.value) {
        const value = a.value * 2;
        tiles.push({ ...a, row, col, kind: "consumed" });
        tiles.push({ ...b, row, col, kind: "consumed" });
        tiles.push({ id: nextId++, value, row, col, kind: "merged" });
        gained += value;
        if (value >= WIN_VALUE) won = true;
        changed = true;
        i++;
      } else {
        if (a.row !== row || a.col !== col) changed = true;
        tiles.push({ ...a, row, col, kind: "moved" });
      }
      slot++;
    }
  }

  if (!changed) return game;

  const next = spawn(
    { ...game, tiles, nextId, score: game.score + gained, won },
    rng,
  );
  return { ...next, over: !canMove(next) };
}

/** Builds a game from a grid of values (0 = empty). Handy for tests. */
export function fromGrid(grid: number[][], score = 0): Game {
  const tiles: Tile[] = [];
  let id = 1;
  grid.forEach((row, r) =>
    row.forEach((value, c) => {
      if (value !== 0)
        tiles.push({ id: id++, value, row: r, col: c, kind: "moved" });
    }),
  );
  const game: Game = {
    size: grid.length,
    tiles,
    score,
    nextId: id,
    won: tiles.some((t) => t.value >= WIN_VALUE),
    over: false,
  };
  return { ...game, over: !canMove(game) };
}
