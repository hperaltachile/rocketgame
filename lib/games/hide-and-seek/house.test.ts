import { describe, expect, it } from "vitest";
import { TILE } from "./config";
import {
  COLS,
  FURNITURE,
  MAP,
  PLAYER_START,
  ROOMS,
  ROWS,
  SEEKER_START,
  roomAt,
} from "./house";
import {
  buildGrid,
  distanceField,
  findPath,
  isSolid,
  lineOfSight,
  visionPolygon,
} from "./nav";

const grid = buildGrid();
const reach = distanceField(grid, PLAYER_START);
const at = (c: number, r: number) => reach[r * COLS + c];

describe("the house", () => {
  it("is a rectangle walled in on every side", () => {
    for (const row of MAP) expect(row).toHaveLength(COLS);
    expect(ROWS).toBe(MAP.length);
    for (let c = 0; c < COLS; c++) {
      expect("#O").toContain(MAP[0][c]);
      expect("#O").toContain(MAP[ROWS - 1][c]);
    }
    for (let r = 0; r < ROWS; r++) {
      expect("#O").toContain(MAP[r][0]);
      expect("#O").toContain(MAP[r][COLS - 1]);
    }
    expect(MAP.join("")).toMatch(/^[#O.d]+$/);
  });

  it("keeps furniture on the floor of one room", () => {
    for (const f of FURNITURE) {
      const room = roomAt(f.col, f.row);
      for (let r = f.row; r < f.row + f.h; r++) {
        for (let c = f.col; c < f.col + f.w; c++) {
          expect(MAP[r][c], `${f.kind} at ${c},${r}`).toBe(".");
          expect(roomAt(c, r).id, `${f.kind} at ${c},${r}`).toBe(room.id);
        }
      }
    }
  });

  it("can reach every floor tile from the start", () => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!isSolid(grid, c, r))
          expect(at(c, r), `tile ${c},${r}`).toBeGreaterThanOrEqual(0);
      }
    }
    expect(isSolid(grid, ...PLAYER_START)).toBe(false);
    expect(isSolid(grid, ...SEEKER_START)).toBe(false);
  });

  it("has at least 8 hiding spots, each reachable and next to its furniture", () => {
    expect(grid.spots.length).toBeGreaterThanOrEqual(8);
    expect(new Set(grid.spots.map((s) => s.id)).size).toBe(grid.spots.length);
    const rooms = new Set(grid.spots.map((s) => s.room));
    expect(rooms.size).toBeGreaterThanOrEqual(6);
    for (const spot of grid.spots) {
      const [c, r] = spot.approach;
      expect(isSolid(grid, c, r), spot.id).toBe(false);
      expect(at(c, r), spot.id).toBeGreaterThanOrEqual(0);
      const f = spot.furniture;
      const touching =
        c >= f.col - 1 &&
        c <= f.col + f.w &&
        r >= f.row - 1 &&
        r <= f.row + f.h;
      expect(touching, spot.id).toBe(true);
      expect(spot.suspicion).toBeGreaterThan(0);
      expect(spot.suspicion).toBeLessThanOrEqual(1);
    }
    // Not every spot is equally safe.
    const s = grid.spots.map((x) => x.suspicion);
    expect(Math.max(...s) - Math.min(...s)).toBeGreaterThan(0.4);
  });

  it("gives every room at least two ways in or out, so no trapping dead ends", () => {
    for (const room of ROOMS) {
      let ways = 0;
      for (let r = room.row - 1; r <= room.row + room.h; r++) {
        for (let c = room.col - 1; c <= room.col + room.w; c++) {
          const edge =
            r === room.row - 1 ||
            r === room.row + room.h ||
            c === room.col - 1 ||
            c === room.col + room.w;
          if (edge && MAP[r]?.[c] === "d") ways++;
        }
      }
      // Doorways are 2 tiles wide: count openings, not tiles.
      expect(Math.ceil(ways / 2), room.name).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("navigation", () => {
  it("finds paths around furniture without cutting corners", () => {
    for (const spot of grid.spots) {
      const path = findPath(grid, SEEKER_START, spot.approach)!;
      expect(path, spot.id).not.toBeNull();
      let prev = SEEKER_START;
      for (const tile of path) {
        expect(isSolid(grid, ...tile)).toBe(false);
        const dx = tile[0] - prev[0];
        const dy = tile[1] - prev[1];
        expect(Math.max(Math.abs(dx), Math.abs(dy))).toBe(1);
        if (dx && dy) {
          expect(isSolid(grid, prev[0] + dx, prev[1])).toBe(false);
          expect(isSolid(grid, prev[0], prev[1] + dy)).toBe(false);
        }
        prev = tile;
      }
    }
  });

  it("returns null for a wall and [] for the same tile", () => {
    expect(findPath(grid, PLAYER_START, [0, 0])).toBeNull();
    expect(findPath(grid, PLAYER_START, PLAYER_START)).toEqual([]);
  });

  it("blocks sight with walls and tall furniture, not low furniture", () => {
    const px = (c: number) => (c + 0.5) * TILE;
    // Through the wall between the bedroom and the bathroom.
    expect(lineOfSight(grid, px(9), px(3), px(13), px(3))).toBe(false);
    // Across the open hall.
    expect(lineOfSight(grid, px(3), px(10), px(30), px(10))).toBe(true);
    // Over the low dining table (cols 27-30, rows 17-18).
    expect(lineOfSight(grid, px(26), px(17.5), px(32), px(17.5))).toBe(true);
    // Not through the tall storage shelf (col 16, rows 12-15).
    expect(lineOfSight(grid, px(17), px(13), px(15), px(13))).toBe(false);
  });

  it("clips the flashlight cone at walls", () => {
    const x = 5.5 * TILE;
    const y = 2.5 * TILE;
    const cone = visionPolygon(grid, x, y, 0, 0.3, 20 * TILE);
    // Facing right from the bedroom, nothing gets past the wall at col 11.
    for (const [px] of cone.slice(1))
      expect(px).toBeLessThanOrEqual(11 * TILE + 2);
  });
});
