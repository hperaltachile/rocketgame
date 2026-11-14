/**
 * The house as a grid: what blocks walking and sight, paths (A*, 8-way, no
 * corner cutting), walking distances for hearing, and line of sight.
 */

import { TILE } from "./config";
import {
  COLS,
  FURNITURE,
  MAP,
  ROWS,
  roomAt,
  type Furniture,
  type SpotInfo,
} from "./house";

export type Tile = [number, number];

export type Grid = {
  cols: number;
  rows: number;
  /** 1 = can't walk here (walls, windows, furniture). */
  solid: Uint8Array;
  /** 1 = blocks sight (walls, windows, tall furniture). */
  opaque: Uint8Array;
  /** 1 = doorway. */
  door: Uint8Array;
  /** Which furniture covers each tile (index into FURNITURE), or -1. */
  furniture: Int16Array;
  spots: SpotInfo[];
};

export function buildGrid(
  map: readonly string[] = MAP,
  furniture: readonly Furniture[] = FURNITURE,
): Grid {
  const cols = map[0].length;
  const rows = map.length;
  const solid = new Uint8Array(cols * rows);
  const opaque = new Uint8Array(cols * rows);
  const door = new Uint8Array(cols * rows);
  const owner = new Int16Array(cols * rows).fill(-1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = map[r][c];
      const i = r * cols + c;
      if (ch === "#" || ch === "O") {
        solid[i] = 1;
        opaque[i] = 1;
      }
      if (ch === "d") door[i] = 1;
    }
  }
  const spots: SpotInfo[] = [];
  furniture.forEach((item, index) => {
    if (item.flat) return;
    for (let r = item.row; r < item.row + item.h; r++) {
      for (let c = item.col; c < item.col + item.w; c++) {
        const i = r * cols + c;
        solid[i] = 1;
        if (item.tall) opaque[i] = 1;
        owner[i] = index;
      }
    }
    if (item.spot) {
      spots.push({
        ...item.spot,
        furniture: item,
        room: roomAt(item.col, item.row).id,
        x: (item.col + item.w / 2) * TILE,
        y: (item.row + item.h / 2) * TILE,
      });
    }
  });
  return { cols, rows, solid, opaque, door, furniture: owner, spots };
}

export const inside = (g: Grid, c: number, r: number) =>
  c >= 0 && r >= 0 && c < g.cols && r < g.rows;

export const isSolid = (g: Grid, c: number, r: number) =>
  !inside(g, c, r) || g.solid[r * g.cols + c] === 1;

export const isOpaque = (g: Grid, c: number, r: number) =>
  !inside(g, c, r) || g.opaque[r * g.cols + c] === 1;

export const isDoor = (g: Grid, c: number, r: number) =>
  inside(g, c, r) && g.door[r * g.cols + c] === 1;

export const tileOf = (x: number, y: number): Tile => [
  Math.floor(x / TILE),
  Math.floor(y / TILE),
];

export const centerOf = ([c, r]: Tile) => ({
  x: (c + 0.5) * TILE,
  y: (r + 0.5) * TILE,
});

const DIRS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * Shortest walkable path from `from` to `to` (both tiles), excluding `from`.
 * Diagonal steps are only taken when both side tiles are open, so a body
 * following tile centres never clips a corner. Null if there is no path.
 */
export function findPath(g: Grid, from: Tile, to: Tile): Tile[] | null {
  if (isSolid(g, to[0], to[1])) return null;
  const n = g.cols * g.rows;
  const start = from[1] * g.cols + from[0];
  const goal = to[1] * g.cols + to[0];
  if (start === goal) return [];
  const cost = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open: number[] = [start];
  const score = new Float64Array(n).fill(Infinity);
  cost[start] = 0;
  const h = (i: number) => {
    const dx = Math.abs((i % g.cols) - to[0]);
    const dy = Math.abs(Math.floor(i / g.cols) - to[1]);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  score[start] = h(start);
  while (open.length > 0) {
    // Small grid: a linear scan for the best open node is fast enough.
    let best = 0;
    for (let k = 1; k < open.length; k++)
      if (score[open[k]] < score[open[best]]) best = k;
    const cur = open[best];
    open[best] = open[open.length - 1];
    open.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cc = cur % g.cols;
    const cr = Math.floor(cur / g.cols);
    for (const [dx, dy, step] of DIRS) {
      const nc = cc + dx;
      const nr = cr + dy;
      if (isSolid(g, nc, nr)) continue;
      if (dx !== 0 && dy !== 0) {
        if (isSolid(g, cc + dx, cr) || isSolid(g, cc, cr + dy)) continue;
      }
      const ni = nr * g.cols + nc;
      const c = cost[cur] + step;
      if (c < cost[ni]) {
        cost[ni] = c;
        prev[ni] = cur;
        score[ni] = c + h(ni);
        open.push(ni);
      }
    }
  }
  if (prev[goal] === -1) return null;
  const path: Tile[] = [];
  for (let i = goal; i !== start; i = prev[i]) {
    path.push([i % g.cols, Math.floor(i / g.cols)]);
  }
  return path.reverse();
}

/** Walking steps (4-way) from a tile to every tile; -1 where unreachable. */
export function distanceField(g: Grid, from: Tile): Int32Array {
  const dist = new Int32Array(g.cols * g.rows).fill(-1);
  if (isSolid(g, from[0], from[1])) return dist;
  const queue = [from[1] * g.cols + from[0]];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cc = cur % g.cols;
    const cr = Math.floor(cur / g.cols);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nc = cc + dx;
      const nr = cr + dy;
      if (isSolid(g, nc, nr)) continue;
      const ni = nr * g.cols + nc;
      if (dist[ni] !== -1) continue;
      dist[ni] = dist[cur] + 1;
      queue.push(ni);
    }
  }
  return dist;
}

/** Sample spacing for sight lines, in art px. */
const SIGHT_STEP = 2;

/** Whether nothing opaque lies between two points (art px). */
export function lineOfSight(
  g: Grid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.ceil(Math.hypot(dx, dy) / SIGHT_STEP);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const [c, r] = tileOf(x0 + dx * t, y0 + dy * t);
    if (isOpaque(g, c, r)) return false;
  }
  return true;
}

/**
 * The flashlight cone as a fan of points (first point is the origin): each
 * ray stops at the first opaque tile or at `range` art px.
 */
export function visionPolygon(
  g: Grid,
  x: number,
  y: number,
  angle: number,
  fov: number,
  range: number,
  rays = 28,
): [number, number][] {
  const points: [number, number][] = [[x, y]];
  for (let i = 0; i <= rays; i++) {
    const a = angle - fov / 2 + (fov * i) / rays;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    let d = 0;
    while (d < range) {
      const next = Math.min(range, d + SIGHT_STEP);
      const [c, r] = tileOf(x + cos * next, y + sin * next);
      if (isOpaque(g, c, r)) break;
      d = next;
    }
    points.push([x + cos * d, y + sin * d]);
  }
  return points;
}

export { COLS, ROWS };
